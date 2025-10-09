# Gmail OAuth Setup Guide for BedreTilbud

## 📋 What You Need to Get from Google Cloud Console

This guide will help you set up Gmail API with full inbox reading permissions.

---

## Step 1: Create Google Cloud Project

1. **Go to Google Cloud Console:**
   - Visit: https://console.cloud.google.com/
   - Sign in with your Gmail account (hej@bedretilbud.com)

2. **Create New Project:**
   - Click the project dropdown at the top
   - Click "NEW PROJECT"
   - Project name: `BedreTilbud Email System`
   - Click "CREATE"
   - Wait for project creation (takes ~30 seconds)
   - Select your new project from the dropdown

---

## Step 2: Enable Gmail API

1. **Navigate to APIs & Services:**
   - In the left sidebar, click "APIs & Services" → "Library"
   - Or visit: https://console.cloud.google.com/apis/library

2. **Enable Gmail API:**
   - Search for "Gmail API"
   - Click on "Gmail API" in results
   - Click "ENABLE" button
   - Wait for it to enable (~10 seconds)

---

## Step 3: Configure OAuth Consent Screen

1. **Go to OAuth Consent Screen:**
   - Left sidebar: "APIs & Services" → "OAuth consent screen"
   - Or visit: https://console.cloud.google.com/apis/credentials/consent

2. **Choose User Type:**
   - Select **"External"** (allows any Gmail user to authorize)
   - Click "CREATE"

3. **Fill in App Information:**
   - **App name:** `BedreTilbud`
   - **User support email:** hej@bedretilbud.com
   - **App logo:** (optional - skip for now)
   - **Application home page:** Your Replit app URL
   - **Authorized domains:** `bedretilbud.com` (if you have a domain)
   - **Developer contact email:** hej@bedretilbud.com
   - Click "SAVE AND CONTINUE"

4. **Configure Scopes:**
   - Click "ADD OR REMOVE SCOPES"
   - Manually add these scopes (use the "Manually add scopes" option):
     ```
     https://www.googleapis.com/auth/gmail.readonly
     https://www.googleapis.com/auth/gmail.send
     https://www.googleapis.com/auth/gmail.modify
     https://www.googleapis.com/auth/userinfo.email
     ```
   - Click "UPDATE"
   - Click "SAVE AND CONTINUE"

5. **Test Users (Important!):**
   - Click "ADD USERS"
   - Add: `hej@bedretilbud.com`
   - Add any other test emails you want
   - Click "ADD"
   - Click "SAVE AND CONTINUE"

6. **Review:**
   - Review all settings
   - Click "BACK TO DASHBOARD"

---

## Step 4: Create OAuth 2.0 Credentials

1. **Go to Credentials:**
   - Left sidebar: "APIs & Services" → "Credentials"
   - Or visit: https://console.cloud.google.com/apis/credentials

2. **Create Credentials:**
   - Click "CREATE CREDENTIALS" at the top
   - Select "OAuth 2.0 Client ID"

3. **Configure OAuth Client:**
   - **Application type:** Web application
   - **Name:** `BedreTilbud Email Integration`
   
4. **Authorized Redirect URIs:**
   - Click "ADD URI" under "Authorized redirect URIs"
   - Add your Replit app URL + `/auth/gmail/callback`
   - Example: `https://your-repl-name.replit.dev/auth/gmail/callback`
   - **Important:** Replace with your actual Replit URL
   - Click "CREATE"

5. **Save Your Credentials:**
   - A popup will show your credentials
   - **Copy these somewhere safe:**
     - ✅ **Client ID** (looks like: `123456789-abcdef.apps.googleusercontent.com`)
     - ✅ **Client Secret** (looks like: `GOCSPX-abcd1234...`)
   - Click "OK"

---

## Step 5: Add Credentials to Replit

You'll add these as Replit Secrets in the next step. The agent will guide you through this.

**Information You Need to Provide:**

1. **GMAIL_CLIENT_ID:** (from Step 4, #5)
2. **GMAIL_CLIENT_SECRET:** (from Step 4, #5)
3. **Your Replit App URL:** (for redirect URI configuration)

---

## 📝 Quick Checklist

Before proceeding, make sure you have:
- ✅ Created Google Cloud Project
- ✅ Enabled Gmail API
- ✅ Configured OAuth consent screen with correct scopes
- ✅ Added hej@bedretilbud.com as test user
- ✅ Created OAuth 2.0 credentials
- ✅ Copied Client ID and Client Secret
- ✅ Added correct redirect URI in Google Cloud Console

---

## 🔐 Security Notes

- Keep Client ID and Client Secret private
- Never commit them to version control
- Only add them as Replit Secrets
- The OAuth flow will handle user authorization securely

---

## Need Help?

If you encounter any issues:
1. Double-check all scopes are added correctly
2. Verify hej@bedretilbud.com is in test users
3. Ensure redirect URI matches exactly
4. Make sure Gmail API is enabled

Once you have Client ID and Client Secret, come back to the app and I'll help you complete the setup!
