import { google } from 'googleapis';

interface OAuthTokens {
  access_token: string;
  refresh_token: string;
  expiry_date: number;
}

class GmailOAuthService {
  private oauth2Client: any;
  private tokens: OAuthTokens | null = null;

  constructor() {
    this.initializeOAuthClient();
  }

  private initializeOAuthClient() {
    const clientId = process.env.GMAIL_CLIENT_ID;
    const clientSecret = process.env.GMAIL_CLIENT_SECRET;
    const redirectUri = process.env.GMAIL_REDIRECT_URI || `${process.env.REPL_SLUG}.replit.dev/auth/gmail/callback`;

    if (!clientId || !clientSecret) {
      console.warn('⚠️ Gmail OAuth credentials not configured. Set GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET');
      return;
    }

    this.oauth2Client = new google.auth.OAuth2(
      clientId,
      clientSecret,
      redirectUri.startsWith('http') ? redirectUri : `https://${redirectUri}`
    );

    // Load tokens from environment if available
    const storedTokens = process.env.GMAIL_TOKENS;
    if (storedTokens) {
      try {
        this.tokens = JSON.parse(storedTokens);
        this.oauth2Client.setCredentials(this.tokens);
      } catch (error) {
        console.error('Failed to parse stored Gmail tokens:', error);
      }
    }
  }

  getAuthUrl(): string {
    if (!this.oauth2Client) {
      throw new Error('OAuth client not initialized. Check GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET');
    }

    const scopes = [
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/gmail.modify',
      'https://www.googleapis.com/auth/userinfo.email'
    ];

    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      prompt: 'consent' // Force consent to get refresh token
    });
  }

  async handleCallback(code: string): Promise<OAuthTokens> {
    if (!this.oauth2Client) {
      throw new Error('OAuth client not initialized');
    }

    const { tokens } = await this.oauth2Client.getToken(code);
    this.tokens = tokens as OAuthTokens;
    this.oauth2Client.setCredentials(tokens);

    console.log('✅ Gmail OAuth tokens received successfully');
    return this.tokens;
  }

  async getGmailClient() {
    if (!this.oauth2Client) {
      throw new Error('OAuth client not initialized. Configure Gmail OAuth credentials first.');
    }

    if (!this.tokens) {
      throw new Error('No OAuth tokens available. Please authorize the app first.');
    }

    // Check if token is expired and refresh if needed
    if (this.tokens.expiry_date && Date.now() >= this.tokens.expiry_date) {
      console.log('🔄 Refreshing expired Gmail access token...');
      const { credentials } = await this.oauth2Client.refreshAccessToken();
      this.tokens = credentials as OAuthTokens;
      this.oauth2Client.setCredentials(credentials);
      console.log('✅ Gmail access token refreshed');
    }

    return google.gmail({ version: 'v1', auth: this.oauth2Client });
  }

  getTokens(): OAuthTokens | null {
    return this.tokens;
  }

  isConfigured(): boolean {
    return !!this.oauth2Client && !!this.tokens;
  }

  getConnectionStatus() {
    return {
      configured: !!this.oauth2Client,
      authorized: !!this.tokens,
      hasRefreshToken: !!this.tokens?.refresh_token,
      expiresAt: this.tokens?.expiry_date ? new Date(this.tokens.expiry_date).toISOString() : null
    };
  }
}

export const gmailOAuthService = new GmailOAuthService();
