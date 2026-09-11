const express = require("express");
const path = require("path");
const cors = require("cors");
const dotenv = require("dotenv");
const OpenAI = require("openai");
const { createClient } = require("@supabase/supabase-js");
const Stripe = require("stripe");

dotenv.config();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_PUBLISHABLE_KEY
);

const app = express();
const APP_URL = process.env.APP_URL || "http://localhost:3000";


app.use(cors());
app.use(express.static(__dirname));

app.use(
  "/stripe-webhook",
  express.raw({ type: "application/json" })
);


app.use(express.json({ limit: "10mb" }));

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});


app.post("/generate-tattoo", async (req, res) => {
  try {
    const {
      description,
      style,
      placement,
      detail,
      contrast,
      skinReady,
      stencilFriendly,
      referenceImage,
    } = req.body;

    if (!description || !description.trim()) {
      return res.status(400).json({
        error: "Please describe the tattoo you want to create.",
      });
    }

    const tattooPrompt = `
Create a professional tattoo concept design.

Tattoo idea:
${description}

Style:
${style || "Black and grey realism"}

Body placement:
${placement || "Not specified"}

Detail level:
${detail || "High"}

Contrast:
${contrast || "High"}

Skin-ready shading:
${skinReady ? "Yes" : "No"}

Stencil-friendly structure:
${stencilFriendly ? "Yes" : "No"}

Requirements:
- Design this specifically as tattoo concept art.
- Create a clean, highly detailed central composition.
- Make the artwork practical for a professional tattoo artist to interpret.
- Use strong readable silhouettes and intentional negative space.
- Avoid showing the tattoo already applied to a person's skin.
- Present the artwork on a clean neutral background.
- Do not include mockup text, watermarks, UI elements, or logos.
`;

    let imageBase64;

    if (!referenceImage) {
      const result = await openai.images.generate({
        model: "gpt-image-2",
        prompt: tattooPrompt,
        size: "1024x1024",
        quality: "medium",
      });

      imageBase64 = result.data?.[0]?.b64_json;
    } else {
      const response = await openai.responses.create({
        model: "gpt-5.6",
        input: [
          {
            role: "user",
            content: [
              { type: "input_text", text: tattooPrompt },
              { type: "input_image", image_url: referenceImage },
            ],
          },
        ],
        tools: [{ type: "image_generation" }],
      });

      imageBase64 = response.output?.find(
        (item) => item.type === "image_generation_call"
      )?.result;
    }

    if (!imageBase64) {
      throw new Error("The AI did not return an image.");
    }

    res.json({
      image: `data:image/png;base64,${imageBase64}`,
    });
  } catch (error) {
    console.error("Tattoo generation error:", error);

    res.status(500).json({
      error:
        error?.message ||
        "Something went wrong while generating your tattoo.",
    });
  }
});
app.post("/signup", async (req, res) => {
  try {
    const { email, password } = req.body;

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({
      message: "Account created successfully.",
      user: data.user,
    });
  } catch (error) {
    console.error("Signup error:", error);
    res.status(500).json({ error: "Unable to create account." });
  }
});
app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({
      message: "Signed in successfully.",
      user: data.user,
      session: data.session,
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Unable to sign in." });
  }
});

app.get("/auth/google", async (req, res) => {
  try {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: APP_URL,
        skipBrowserRedirect: true,
      },
    });

    if (error) throw error;

    res.json({ url: data.url });
  } catch (error) {
    console.error("Google OAuth error:", error);
    res.status(500).json({
      error: error.message || "Unable to start Google sign-in.",
    });
  }
});
app.post("/create-checkout-session", async (req, res) => {
  try {
    const { plan } = req.body;

    const authHeader = req.headers.authorization;
const accessToken = authHeader?.startsWith("Bearer ")
  ? authHeader.slice(7)
  : null;

if (!accessToken) {
  return res.status(401).json({
    error: "You must be signed in before subscribing.",
  });
}

const {
  data: { user },
  error: authError,
} = await supabase.auth.getUser(accessToken);

if (authError || !user) {
  return res.status(401).json({
    error: "Your login session is invalid or expired.",
  });
}

    let priceId;

    if (plan === "gold") {
      priceId = process.env.STRIPE_GOLD_PRICE_ID;
    } else if (plan === "platinum") {
      priceId = process.env.STRIPE_PLATINUM_PRICE_ID;
    } else {
      return res.status(400).json({ error: "Invalid plan selected." });
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      client_reference_id: user.id,

metadata: {
  user_id: user.id,
  plan: plan,
},

      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: `${APP_URL}/?checkout=success`,
      cancel_url: `${APP_URL}/?checkout=cancelled`,
    });

    res.json({ url: session.url });
  } catch (error) {
    console.error("Stripe Checkout error:", error);

    res.status(500).json({
      error: error.message || "Unable to start checkout.",
    });
  }
});
app.post("/stripe-webhook", (req, res) => {
  const signature = req.headers["stripe-signature"];

  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (error) {
    console.error("Stripe webhook signature error:", error.message);
    return res.status(400).send(`Webhook Error: ${error.message}`);
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;

    console.log("Stripe subscription checkout completed:", {
      userId: session.metadata?.user_id,
      plan: session.metadata?.plan,
      customer: session.customer,
      subscription: session.subscription,
    });
  }

  res.json({ received: true });
});
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Torrosian AI server running on http://localhost:${PORT}`);
});

