import OpenAI from "openai";
import { storage } from "../storage";
import { InsertAiDebugReport } from "@shared/schema";
import { logger } from "../utils/logging";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface ClassifierOutput {
  category: string;
  intent: string;
  informationRequest: string | null;
}

interface DebugAnalysis {
  quality_score: number;
  language_correct: boolean;
  tone_appropriate: boolean;
  answered_question: boolean;
  privacy_preserved: boolean;
  issues: string[];
  suggestions: string[];
  summary: string;
}

const PROMPT_VERSION = "v1.0.0";

export class DebugAgentService {
  async analyzeResponse(params: {
    threadId: string;
    companyMessageId: string;
    companyMessageBody: string;
    aiMessageId: string;
    aiMessageBody: string;
    classifierOutput: ClassifierOutput;
  }): Promise<void> {
    const {
      threadId,
      companyMessageId,
      companyMessageBody,
      aiMessageId,
      aiMessageBody,
      classifierOutput,
    } = params;

    try {
      logger.info("[DebugAgent] Analyzing AI response", {
        threadId,
        aiMessageId,
        classifierCategory: classifierOutput.category,
      });

      const systemPrompt = `Du er en kvalitetskontrol-agent for AI-genererede emails på dansk.

Din opgave er at analysere AI-svar og vurdere kvaliteten baseret på følgende kriterier:

1. SPROG: Er svaret skrevet på korrekt dansk (ikke engelsk)?
2. TONE: Er tonen professionel, venlig og passende for forsikringskommunikation?
3. SVAR: Besvarede AI'en faktisk det spørgsmål/problem som forsikringsselskabet stillede?
4. PRIVATLIV: Blev brugerens private data (CPR, telefon, email) kun delt hvis det eksplicit blev anmodet?
5. KVALITET: Er svaret klart, koncist og nyttigt?

Returner din analyse som JSON med følgende struktur:
{
  "quality_score": 1-10 (heltal),
  "language_correct": true/false (dansk, ikke engelsk),
  "tone_appropriate": true/false,
  "answered_question": true/false,
  "privacy_preserved": true/false,
  "issues": ["liste af identificerede problemer"],
  "suggestions": ["liste af forbedringsforslag"],
  "summary": "kort opsummering af analysen på dansk"
}`;

      const userPrompt = `Analyser følgende AI-svar:

FORSIKRINGSSELSKABETS BESKED:
${companyMessageBody}

KLASSIFICERING AF BESKED:
- Kategori: ${classifierOutput.category}
- Intent: ${classifierOutput.intent}
- Informationsanmodning: ${classifierOutput.informationRequest || 'Ingen specifik anmodning'}

AI'ENS SVAR:
${aiMessageBody}

Udfør din kvalitetsanalyse og returner JSON.`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.3,
        response_format: { type: "json_object" },
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error("No response from debug analysis");
      }

      let analysis: DebugAnalysis;
      try {
        analysis = JSON.parse(content);
      } catch (parseError) {
        logger.error("[DebugAgent] Failed to parse analysis JSON", { content });
        throw new Error("Invalid JSON from debug analysis");
      }

      const debugReport: InsertAiDebugReport = {
        threadId,
        companyMessageId,
        aiMessageId,
        finalSentBody: aiMessageBody,
        classifierOutput: classifierOutput as any,
        replyPromptVersion: PROMPT_VERSION,
        analysis: analysis as any,
      };

      await storage.createAiDebugReport(debugReport);

      logger.info("[DebugAgent] Analysis complete", {
        threadId,
        aiMessageId,
        qualityScore: analysis.quality_score,
        languageCorrect: analysis.language_correct,
        issueCount: analysis.issues.length,
      });

      if (analysis.quality_score < 6 || !analysis.language_correct || !analysis.privacy_preserved) {
        logger.warn("[DebugAgent] Low quality response detected", {
          threadId,
          aiMessageId,
          qualityScore: analysis.quality_score,
          issues: analysis.issues,
        });
      }
    } catch (error) {
      logger.error("[DebugAgent] Analysis failed", {
        error: error instanceof Error ? error.message : "Unknown error",
        threadId,
        aiMessageId,
      });
    }
  }

  async getRecentReports(threadId?: string, limit = 50): Promise<any[]> {
    return storage.getAiDebugReports(threadId, limit);
  }

  async getReportByMessageId(aiMessageId: string): Promise<any | undefined> {
    return storage.getAiDebugReportByMessageId(aiMessageId);
  }

  async getAggregatedMetrics(days = 7): Promise<{
    totalReports: number;
    avgQualityScore: number;
    languageErrorRate: number;
    privacyIssueRate: number;
    commonIssues: { issue: string; count: number }[];
  }> {
    const reports = await storage.getAiDebugReports(undefined, 1000);
    
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    
    const recentReports = reports.filter(r => 
      r.createdAt && new Date(r.createdAt) >= cutoffDate
    );

    if (recentReports.length === 0) {
      return {
        totalReports: 0,
        avgQualityScore: 0,
        languageErrorRate: 0,
        privacyIssueRate: 0,
        commonIssues: [],
      };
    }

    let totalScore = 0;
    let languageErrors = 0;
    let privacyIssues = 0;
    const issueCounter = new Map<string, number>();

    for (const report of recentReports) {
      const analysis = report.analysis as DebugAnalysis | null;
      if (!analysis) continue;

      totalScore += analysis.quality_score || 0;
      if (!analysis.language_correct) languageErrors++;
      if (!analysis.privacy_preserved) privacyIssues++;

      for (const issue of analysis.issues || []) {
        issueCounter.set(issue, (issueCounter.get(issue) || 0) + 1);
      }
    }

    const commonIssues = Array.from(issueCounter.entries())
      .map(([issue, count]) => ({ issue, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      totalReports: recentReports.length,
      avgQualityScore: recentReports.length > 0 ? totalScore / recentReports.length : 0,
      languageErrorRate: recentReports.length > 0 ? languageErrors / recentReports.length : 0,
      privacyIssueRate: recentReports.length > 0 ? privacyIssues / recentReports.length : 0,
      commonIssues,
    };
  }
}

export const debugAgentService = new DebugAgentService();
