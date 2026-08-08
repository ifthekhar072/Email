const fs = require("fs");
const path = require("path");

// --- Vercel Build Trick ---
// ADD your PDF file here to ensure it's included in the deployment.
try {
  fs.readFileSync(path.join(__dirname, 'july two year.png'));
} catch (e) {
  // This block might show an error in a local terminal, which is okay.
}
// --- End of Trick ---


const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  "https://tgdahcqseukfivaziawp.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRnZGFoY3FzZXVrZml2YXppYXdwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYxOTIxNzYsImV4cCI6MjEwMTc2ODE3Nn0.H3ptyXobZxbcAuj2vUU6DCVPpjgSTFZBoJ88FUft6Ag"
);

// CHANGED: Renamed to fileConfig to handle any file type
const fileConfig = {
  july: "july two year.png",
};

// Use a fallback image if the type is invalid
const defaultFile = "pixel.png"; // CHANGED: Renamed for clarity

module.exports = async (req, res) => {
  try {
    const type = req.query.type || "unknown";
    const emailId = req.query.emailId || "unknown";

    const logEntry = {
      emailId,
      time: new Date().toISOString(),
      tag: type,
    };

    // This logs the access attempt to your database
    await supabase.from("logs").insert([logEntry]);

    const fileName = fileConfig[type] || defaultFile; // CHANGED: Using the new config object
    const filePath = path.join(__dirname, fileName);

    if (!fs.existsSync(filePath)) {
      console.error(`CRITICAL: The file system check failed for path: ${filePath}`);
      return res.status(500).send(`Server error: File "${fileName}" was not found.`);
    }

    const getMimeType = (file) => {
      switch (path.extname(file).toLowerCase()) {
        case ".png": return "image/png";
        case ".jpg": case ".jpeg": return "image/jpeg";
        case ".gif": return "image/gif";
        case ".pdf": return "application/pdf"; // ADDED: Mime type for PDF
        default: return "application/octet-stream";
      }
    };
    
    const fileContents = fs.readFileSync(filePath);

    // Set the correct Content-Type header so the browser knows how to handle the file
    res.setHeader("Content-Type", getMimeType(fileName));
    return res.status(200).send(fileContents);

  } catch (err) {
    console.error("Handler Error:", err);
    return res.status(500).send("Internal Server Error");
  }
};
