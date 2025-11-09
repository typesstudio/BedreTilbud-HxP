import { mistralOcrService } from '../services/mistralOcrService';

const OFFER_DOCUMENT_PATH = 'uploads/attachment_1762595895265_Offer Insurance.pdf';

async function main() {
  console.log('[Debug OCR] Extracting raw markdown from:', OFFER_DOCUMENT_PATH);
  
  const markdown = await mistralOcrService.extractTextFromPDF(OFFER_DOCUMENT_PATH);
  
  console.log('\n=== RAW MARKDOWN OUTPUT ===\n');
  console.log(markdown);
  console.log('\n=== END MARKDOWN ===\n');
  
  // Search for indbo pricing patterns
  console.log('\n=== SEARCHING FOR INDBO PRICING PATTERNS ===\n');
  
  const patterns = [
    /Din pris pr\. år.*?(\d[\d\s.,]*)\s*kr/gi,
    /Indboforsikring[\s\S]{0,500}?(\d[\d\s.,]*)\s*kr/gi,
    /3\.154/g,
    /3154/g
  ];
  
  patterns.forEach((pattern, idx) => {
    console.log(`\nPattern ${idx + 1}: ${pattern}`);
    const matches = markdown.match(pattern);
    if (matches) {
      console.log('Matches found:');
      matches.forEach(match => console.log(`  - ${match.substring(0, 200)}`));
    } else {
      console.log('No matches found');
    }
  });
}

main().catch(console.error);
