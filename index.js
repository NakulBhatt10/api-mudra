import express from "express";
import cors from "cors";
import multer from "multer";
import dotenv from "dotenv";
import { Resend } from "resend";

dotenv.config();

const app = express();

// Allow your Vite frontend
app.use(
  cors({
    origin: true, // lock later to your frontend domain
    methods: ["GET", "POST", "OPTIONS"],
  })
);
app.options("*", cors());

// Multer in-memory (so we can attach files)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB each
});

app.get("/health", (req, res) => res.json({ ok: true }));

const resend = new Resend(process.env.RESEND_API_KEY);

app.post(
  "/apply",
  upload.fields([
    { name: "pan", maxCount: 1 },
    { name: "aadhaar", maxCount: 1 },
    { name: "gst", maxCount: 1 },
    { name: "udyam", maxCount: 1 },
    { name: "other", maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      console.log("✅ /apply hit");
      console.log("Body keys:", Object.keys(req.body || {}));
      console.log("Files keys:", Object.keys(req.files || {}));

      const {
        fullName,
        mobile,
        email,
        city,
        state,
        businessName,
        businessType,
        businessVintage,
        annualTurnover,
        loanType,
        loanAmount,
        loanPurpose,
        message,
      } = req.body;

      const RESEND_API_KEY = process.env.RESEND_API_KEY;
      const FROM_EMAIL = process.env.FROM_EMAIL;
      const TO_EMAIL = process.env.TO_EMAIL;

      if (!RESEND_API_KEY || !FROM_EMAIL || !TO_EMAIL) {
        return res.status(500).json({
          ok: false,
          error: "Missing RESEND_API_KEY / FROM_EMAIL / TO_EMAIL in env",
        });
      }

      const files = req.files || {};
      const attachments = [];

      const addAttachment = (key) => {
        const f = files?.[key]?.[0];
        if (!f) return;
        attachments.push({
          filename: f.originalname,
          content: f.buffer.toString("base64"), // Resend expects Base64 string or Buffer :contentReference[oaicite:1]{index=1}
        });
      };

      ["pan", "aadhaar", "gst", "udyam", "other"].forEach(addAttachment);

      console.log("Attachments count:", attachments.length);

      const text =
        (message && String(message).trim()) ||
        `
NEW MUDRA LOAN APPLICATION
--------------------------
Full Name: ${fullName || ""}
Mobile: ${mobile || ""}
Email: ${email || ""}
City: ${city || ""}
State: ${state || ""}

Business Name: ${businessName || ""}
Business Type: ${businessType || ""}
Business Vintage: ${businessVintage || ""}
Annual Turnover: ${annualTurnover || ""}

Loan Type: ${loanType || ""}
Loan Amount: ${loanAmount || ""}
Loan Purpose: ${loanPurpose || ""}
        `.trim();

      const { data, error } = await resend.emails.send({
        from: FROM_EMAIL,
        to: [TO_EMAIL],
        subject: `New Application - ${fullName || "Unknown"} (${mobile || "No Mobile"})`,
        text,
        attachments: attachments.length ? attachments : undefined,
      });

      if (error) {
        console.error("❌ Resend error:", error);
        return res.status(500).json({
          ok: false,
          error: error.message || "Resend email failed",
        });
      }

      console.log("✅ Email sent via Resend:", data?.id);
      return res.json({ ok: true });
    } catch (err) {
      console.error("Server error:", err);
      return res.status(500).json({
        ok: false,
        error: err?.message || "Email failed on server",
      });
    }
  }
);

const PORT = process.env.PORT || 3001;
app.listen(PORT, "0.0.0.0", () =>
  console.log(`✅ Server running on http://localhost:${PORT}`)
);
