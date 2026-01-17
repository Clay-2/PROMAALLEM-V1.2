# 🗄️ Guide: Setting up Supabase Database

Since I cannot access your Supabase account directly, please follow these 3 simple steps to activate your database.

## Step 1: Create Project & Get Credentials
1. Go to [Supabase.com](https://supabase.com) and create a new project.
2. Once created, go to **Project Settings** (Auto-generated icon at bottom left) > **API**.
3. Copy the **Project URL**.
4. Copy the **anon / public** key.

## Step 2: Configure your Environment
1. Open the `.env` file in your project folder `c:\Users\HP ENVY\Desktop\promaallem\.env`.
2. Paste the values like this:

```env
SUPABASE_URL=https://xyz...supabase.co
SUPABASE_KEY=eyJhbGciOiJIUzI1NiIsInR5c...
```
*(Keep the DEEPSEEK_API_KEY as is)*

## Step 3: Run the Schema
1. Open the `schema.sql` file I created in your project folder.
2. Select all text and Copy it.
3. Go back to your Supabase Dashboard.
4. Click on **SQL Editor** (icon looking like `>_` on the left).
5. Click **New query**.
6. Paste the code and click **Run** (bottom right).

## Step 4: Verify
1. In `c:\Users\HP ENVY\Desktop\promaallem`, open a terminal.
2. Run `npm install` (if you haven't).
3. Run `npm run dev`.
4. If you see `ProMaallem API running on port 3000`, you are connected!
