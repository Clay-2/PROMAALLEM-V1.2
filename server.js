require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Supabase Configuration
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// --- Helpers ---
// Middleware to verify JWT and attach user to request
const authenticateUser = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).json({ error: 'Missing Authorization header' });
    }

    const token = authHeader.split(' ')[1];
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
        return res.status(401).json({ error: 'Invalid or expired token' });
    }

    req.user = user;
    next();
};

// --- Endpoints ---

// 1. POST /api/auth/register
app.post('/api/auth/register', async (req, res) => {
    const { email, password, full_name, phone, role, city } = req.body;

    if (!email || !password || !role) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    // 1. Create Auth User
    const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
    });

    if (authError) return res.status(400).json({ error: authError.message });
    if (!authData.user) return res.status(500).json({ error: 'User creation failed' });

    // 2. Create Profile
    const { error: profileError } = await supabase
        .from('profiles')
        .insert([
            {
                id: authData.user.id,
                full_name,
                role, // 'client' or 'maallem'
                phone,
                city: city || 'Casablanca'
            }
        ]);

    if (profileError) {
        return res.status(400).json({ error: 'Error creating profile: ' + profileError.message });
    }

    res.status(201).json({ message: 'User registered successfully', user: authData.user });
});

// 2. GET /api/services
app.get('/api/services', async (req, res) => {
    const { data, error } = await supabase
        .from('services')
        .select('*');

    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

// 3. POST /api/bookings/sos (Emergency Booking)
app.post('/api/bookings/sos', async (req, res) => {
    const { service_id, address, phone, full_name, urgency } = req.body;
    let client_id = null;
    let guest_phone = phone;
    let guest_name = full_name;

    // 1. Try to Authenticate (Optional)
    const authHeader = req.headers.authorization;
    if (authHeader) {
        const token = authHeader.split(' ')[1];
        const { data: { user } } = await supabase.auth.getUser(token);
        if (user) client_id = user.id;
    }

    // 2. Validation
    if (!client_id && !guest_phone) {
        return res.status(400).json({ error: 'Phone number is required for guest bookings' });
    }

    // 3. Logic: Find Maallem (Mock)
    // In a real app, this would use geospatial query (PostGIS)
    const { data: maallems } = await supabase
        .from('profiles')
        .select('id')
        .eq('role', 'maallem')
        .eq('is_available', true)
        .limit(1);

    const maallem_id = maallems && maallems.length > 0 ? maallems[0].id : null;

    // 4. Create Booking
    const { data, error } = await supabase
        .from('bookings')
        .insert([
            {
                client_id: client_id, // Nullable for guests
                guest_name: guest_name,
                guest_phone: guest_phone,
                maallem_id: maallem_id,
                service_id: service_id, // Can be null if generic "Service" text is passed, need to handle
                status: 'pending',
                is_emergency: urgency === 'urgent' || urgency === true, // Handle boolean or string
                address: address
            }
        ])
        .select();

    if (error) {
        console.error('Booking Error:', error);
        return res.status(500).json({ error: error.message });
    }

    res.status(201).json({
        message: 'SOS Booking created',
        booking: data[0],
        maallem_found: !!maallem_id
    });
});

// 4. GET /api/maallems/nearby
app.get('/api/maallems/nearby', async (req, res) => {
    const { city } = req.query; // e.g. ?city=Casablanca

    let query = supabase
        .from('profiles')
        .select('id, full_name, role, city, rating, avatar_url')
        .eq('role', 'maallem')
        .eq('is_available', true);

    if (city) {
        query = query.ilike('city', `%${city}%`);
    }

    const { data, error } = await query;

    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

// --- AI Integration (DeepSeek / GitHub Models) ---
const OpenAI = require('openai');

const apiKey = process.env.DEEPSEEK_API_KEY;
const isGitHub = apiKey && apiKey.startsWith('github_');

const openai = new OpenAI({
    baseURL: isGitHub ? 'https://models.inference.ai.azure.com' : 'https://api.deepseek.com',
    apiKey: apiKey
});

const AI_MODEL = isGitHub ? 'DeepSeek-R1' : 'deepseek-chat';

// 5. POST /api/ai/analyze-sos (Phase 1: Intelligent Service Classifier)
app.post('/api/ai/analyze-sos', async (req, res) => {
    const { description, location } = req.body; // User's natural language input & optional location

    if (!description) return res.status(400).json({ error: 'Description is required' });

    try {
        const systemPrompt = `
You are the expert service classifier for "ProMaallem", a Moroccan home service marketplace.
Your goal is to analyze client requests (in French, Arabic, or Darija) and structure them for artisans.

**Context & Constraints:**
- **Market**: Morocco (Casablanca mainly).
- **Languages**: Understand Darija terms (e.g., "robini", "bula", "fuit", "chauffe-eau").
- **Pricing**: Estimate in MAD (Dirhams). Plomberie ~150-300DH, Elec ~200-400DH.

**Analysis Steps:**
1. **Categorize**: Plomberie, Électricité, Serrurerie, Peinture, Climatisation, Électroménager.
2. **Diagnose**: Identify specific problem (e.g., "Fuite robinet" vs "Canalisation bouchée").
3. **Urgency**: Score 1 (Low) to 5 (Critical/Danger).
4. **Estimation**: Time range and price range.
5. **Safety**: Immediate instructions if dangerous.

**Output Format**:
Return ONLY valid JSON with no markdown formatting:
{
  "category": "string",
  "confidence_score": 0-100,
  "problem_type": "string",
  "urgency_level": 1-5,
  "estimated_duration": "string",
  "estimated_price_range": "string",
  "suggested_package": "string",
  "possible_complications": ["string"],
  "safety_instructions": "string (or null)",
  "required_tools": ["string"]
}
`;

        const userContent = `Description: ${description}. Location: ${location || 'Casablanca'}`;

        const completion = await openai.chat.completions.create({
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userContent }
            ],
            // DeepSeek specific model or "deepseek-chat" if using their endpoint
            model: AI_MODEL,
            temperature: 0.2, // Low temperature for consistent JSON
            max_tokens: 500
        });

        // Parse AI response
        let aiResponseContent = completion.choices[0].message.content;

        // Cleanup: Remove markdown fences, <think> blocks, and extra whitespace
        aiResponseContent = aiResponseContent.replace(/```json/g, '').replace(/```/g, '');
        aiResponseContent = aiResponseContent.replace(/<think>[\s\S]*?<\/think>/g, '').trim();

        let analysis;
        try {
            analysis = JSON.parse(aiResponseContent);
        } catch (e) {
            console.error("JSON Parse Error", e);
            // Fallback for bad JSON
            analysis = { category: "Unsure", raw_response: aiResponseContent };
        }

        // Optional: Match Category to Service ID in DB
        let serviceMatch = null;
        if (analysis.category) {
            const { data } = await supabase
                .from('services')
                .select('id, name, base_price')
                .ilike('name', `%${analysis.category}%`)
                .maybeSingle(); // Use maybeSingle to avoid 406 on no rows
            serviceMatch = data;
        }

        res.json({
            analysis: analysis,
            service_match: serviceMatch
        });

    } catch (error) {
        console.error('AI Error:', error);
        if (error.status === 429) {
            return res.status(429).json({ error: 'Rate limit exceeded', details: 'Le service IA est très sollicité. Veuillez patienter 1 minute.' });
        }
        res.status(500).json({ error: 'Failed to analyze request', details: error.message });
    }
});

// 6. POST /api/chat/diagnose (Chatbot)
app.post('/api/chat/diagnose', async (req, res) => {
    const { message, previous_messages } = req.body;
    // previous_messages: [{role: 'user', content: '...'}, {role: 'assistant', content: '...'}]

    if (!message) return res.status(400).json({ error: 'Message is required' });

    const systemPrompt = `
You are "Dr. ProMaallem", an expert home service assistant for the Moroccan market.
**Languages:** You MUST reply in the SAME language as the user (French, Arabic, or Moroccan Darija).
**Identity:** You are professional, helpful, and speak with a Moroccan touch when using Darija (use terms like "Maallem", "Bricolage", "Fuite", "Khit").
**Goal:** Diagnose home issues (Plumbing, Electrical, etc.), assess safety risks, and suggest booking a Maallem.
**Safety:** If dangerous (gas leak, sparks), warn immediately to cut power/water.
**Pricing:** Estimate in MAD (e.g., Plomberie ~150DH+, Elec ~200DH+).
**Output:** Keep responses concise and helpful.
`;

    const messages = [
        { role: "system", content: systemPrompt },
        ...(previous_messages || []),
        { role: "user", content: message }
    ];

    try {
        const completion = await openai.chat.completions.create({
            messages: messages,
            model: AI_MODEL,
            temperature: 0.7
        });

        res.json({
            reply: completion.choices[0].message.content
        });

    } catch (error) {
        console.error('AI Chat Error:', error);
        if (error.status === 429) {
            return res.status(429).json({ error: 'Rate limit exceeded', details: 'Le service IA est très sollicité. Veuillez patienter 1 minute.' });
        }
        res.status(500).json({ error: 'Chat failed', details: error.message });
    }
});

// Start Server
app.listen(port, () => {
    console.log(`ProMaallem API running on port ${port}`);
});
