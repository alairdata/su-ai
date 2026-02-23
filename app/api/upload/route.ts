import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/mobile-auth";
import { createClient } from "@supabase/supabase-js";
import { getEffectivePlan } from "@/lib/plans";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];
const ALLOWED_DOC_TYPES = [
  "application/pdf",
  "text/plain", "text/csv", "text/markdown", "text/html",
  "application/json",
  "text/javascript", "application/javascript",
  "text/x-python", "application/x-python", "text/x-script.python",
  "text/css", "text/xml", "application/xml",
  "text/yaml", "application/x-yaml",
  "text/x-java-source", "text/x-c", "text/x-c++src", "text/x-go",
  "text/x-rustsrc", "text/x-ruby", "text/x-shellscript",
  "application/x-sh",
];
const ALLOWED_TYPES = [...ALLOWED_IMAGE_TYPES, ...ALLOWED_DOC_TYPES];

// Extensions that should be allowed as text/plain even if MIME type isn't recognized
const TEXT_FILE_EXTENSIONS = new Set([
  "js", "ts", "jsx", "tsx", "py", "css", "sql", "xml", "yaml", "yml",
  "env", "sh", "rb", "go", "rs", "java", "cpp", "c", "h", "hpp",
  "md", "txt", "csv", "json", "html", "htm", "svg", "toml", "ini",
  "cfg", "conf", "log", "gitignore", "dockerfile", "makefile",
]);

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

function classifyFileType(mimeType: string, fileName: string): "image" | "pdf" | "text" {
  if (ALLOWED_IMAGE_TYPES.includes(mimeType)) return "image";
  if (mimeType === "application/pdf") return "pdf";
  return "text";
}

function isAllowedByExtension(fileName: string): boolean {
  const ext = fileName.split(".").pop()?.toLowerCase() || "";
  return TEXT_FILE_EXTENSIONS.has(ext);
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSessionFromRequest(req);

    if (!session?.user) {
      return NextResponse.json(
        { error: "Please log in to upload images." },
        { status: 401 }
      );
    }

    // Check user plan - only Pro and Plus can upload
    const { data: dbUser, error: userError } = await supabase
      .from("users")
      .select("plan, email")
      .eq("id", session.user.id)
      .single();

    if (userError || !dbUser) {
      return NextResponse.json(
        { error: "User not found." },
        { status: 404 }
      );
    }

    const userPlan = getEffectivePlan(dbUser.plan, dbUser.email);
    if (userPlan === "Free") {
      return NextResponse.json(
        { error: "File upload requires a Pro or Plus plan." },
        { status: 403 }
      );
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const chatId = formData.get("chatId") as string | null;

    if (!file) {
      return NextResponse.json(
        { error: "No file provided." },
        { status: 400 }
      );
    }

    // Validate chatId format (UUID)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!chatId || !uuidRegex.test(chatId)) {
      return NextResponse.json(
        { error: "Invalid chat ID." },
        { status: 400 }
      );
    }

    // Validate file type — check MIME type first, then fall back to extension
    if (!ALLOWED_TYPES.includes(file.type) && !isAllowedByExtension(file.name)) {
      return NextResponse.json(
        { error: "Invalid file type. Allowed: images, PDFs, and common text/code files." },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "File too large. Maximum size is 10MB." },
        { status: 400 }
      );
    }

    // Read file into buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Generate storage path
    const ext = file.name.split(".").pop() || "jpg";
    const sanitizedName = file.name
      .replace(/[^a-zA-Z0-9._-]/g, "_")
      .slice(0, 100);
    const storagePath = `${session.user.id}/${chatId}/${Date.now()}-${sanitizedName}`;

    // Determine the effective content type for storage
    const effectiveContentType = ALLOWED_TYPES.includes(file.type) ? file.type : "text/plain";

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from("chat-images")
      .upload(storagePath, buffer, {
        contentType: effectiveContentType,
        upsert: false,
      });

    if (uploadError) {
      console.error("Supabase storage upload error:", uploadError);
      return NextResponse.json(
        { error: "Failed to upload file." },
        { status: 500 }
      );
    }

    // Get public URL
    const { data: publicUrlData } = supabase.storage
      .from("chat-images")
      .getPublicUrl(storagePath);

    const fileType = classifyFileType(effectiveContentType, file.name);

    return NextResponse.json({
      url: publicUrlData.publicUrl,
      fileType,
      fileName: file.name,
    });
  } catch (error) {
    console.error("Error in /api/upload:", error);
    return NextResponse.json(
      { error: "Something went wrong uploading the file." },
      { status: 500 }
    );
  }
}
