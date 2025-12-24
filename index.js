import express from "express";
import cors from "cors";
import multer from "multer";
import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

const app = express();

// Allow your Vite frontend
app.use(
  cors({
    origin: true, // you can lock this later
    methods: ["GET", "POST", "OPTIONS"],
  })
);
app.options("*", cors());

// Multer in-memory (so we can email as attachments)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB each
});

app.get("/health", (req, res) => res.json({ ok: true }));

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

      const EMAIL_USER = process.env.EMAIL_USER;
      const EMAIL_PASS = process.env.EMAIL_PASS;
      const TO_EMAIL = process.env.TO_EMAIL;

      if (!EMAIL_USER || !EMAIL_PASS || !TO_EMAIL) {
        return res.status(500).json({
          ok: false,
          error: "Missing EMAIL_USER / EMAIL_PASS / TO_EMAIL in .env",
        });
      }

      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: EMAIL_USER,
          pass: EMAIL_PASS, // Gmail App Password (not normal password)
        },
      });

      // ✅ This will tell you immediately if Gmail auth is correct
      await transporter.verify();
      console.log("✅ SMTP verified");

      const files = req.files || {};
      const attachments = [];

      const addAttachment = (key) => {
        const f = files?.[key]?.[0];
        if (!f) return;
        attachments.push({
          filename: f.originalname,
          content: f.buffer,
          contentType: f.mimetype,
        });
      };

      addAttachment("pan");
      addAttachment("aadhaar");
      addAttachment("gst");
      addAttachment("udyam");
      addAttachment("other");

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

      const info = await transporter.sendMail({
        from: EMAIL_USER,
        to: TO_EMAIL,
        subject: `New Application - ${fullName || "Unknown"} (${mobile || "No Mobile"})`,
        text,
        attachments,
      });

      console.log("✅ Mail sent:", info.messageId, info.response);

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
app.listen(PORT, "0.0.0.0", () => console.log(`✅ Server running on http://localhost:${PORT}`));
