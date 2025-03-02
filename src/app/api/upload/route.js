import { GoogleGenerativeAI } from "@google/generative-ai";

export async function POST(req, env) {
  try {
    console.log("📥 Recibiendo archivo de audio...");

    const formData = await req.formData();
    const file = formData.get("audio");

    if (!file) {
      console.error("❌ No se envió ningún archivo.");
      return new Response(JSON.stringify({ error: "No file uploaded" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    console.log("✅ Archivo recibido:", file.name, file.type, file.size, "bytes");

    // 🔹 Verificar que el archivo no supere 1MB (ajustar según sea necesario)
    if (file.size > 1024 * 1024) {
      console.error("❌ Archivo demasiado grande.");
      return new Response(JSON.stringify({ error: "File size exceeds limit (1MB max)" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const fileBuffer = await file.arrayBuffer();
    const fileData = Buffer.from(fileBuffer).toString("base64");

    console.log("🔹 Archivo convertido a Base64, enviando a Gemini...");

    const model = new GoogleGenerativeAI("AIzaSyBA8Dj4xZ2tLlcK9jZtvkjpf_qMZLKGp6U").getGenerativeModel({
      model: "gemini-1.5-flash",
    });

    const result = await model.generateContent([
      "Analyze the provided audio file and extract its content. First, summarize its main idea in a short sentence labeled as 'input'. Then, determine if the content is related to coding or programming. If it is, generate a high-level pseudocode solution labeled as 'output', ensuring it follows this exact structure:\n\n```\nBEGIN\n  [Describe the first step]\n  [Describe the second step]\n  IF [condition] THEN\n    [Action if true]\n  ELSE\n    [Action if false]\n  ENDIF\nEND\n```\n\nIdentify and list all variable names separately under 'variables'. Lastly, provide a brief constructive 'feedback' on the pseudocode. If the content is not related to coding or programming, return 'This is not relevant' as the output.",
      {
        inlineData: {
          data: fileData,
          mimeType: file.type,
        },
      },
    ]);

    if (!result || !result.response) {
      throw new Error("Gemini API response is invalid");
    }

    const geminiOutput = result.response.text();

    console.log("📜 Resultado de Gemini:", geminiOutput);

    // 🔹 Extraer partes clave del output
    const inputMatch = geminiOutput.match(/\*\*input:\*\* (.+)/);
    const outputMatch = geminiOutput.match(/\*\*output:\*\*\n([\s\S]+?)\n\n\*\*variables:/);
    const variablesMatch = geminiOutput.match(/\*\*variables:\*\*\n([\s\S]+?)\n\n\*\*feedback:/);
    const feedbackMatch = geminiOutput.match(/\*\*feedback:\*\*\n([\s\S]+)/);

    const jsonData = {
      input: inputMatch ? inputMatch[1].trim() : "No description available",
      output: outputMatch ? outputMatch[1].trim() : "No pseudocode generated",
      variables: variablesMatch ? variablesMatch[1].trim().split("\n") : [],
      feedback: feedbackMatch ? feedbackMatch[1].trim() : "No feedback available",
    };

    console.log("📦 Guardando respuesta en KV Storage...");
    
    if (!env.audios) {
      throw new Error("KV Storage (audios) is not configured");
    }

    // 🔹 Guardar en KV
    await env.audios.put("geminiResponse", JSON.stringify(jsonData));

    console.log("✅ Datos guardados correctamente.");

    return new Response(
      JSON.stringify({ message: "Processed successfully", response: jsonData }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("❌ Error procesando la solicitud:", error.message);
    return new Response(JSON.stringify({ error: "Internal server error", details: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

export async function GET(req, env) {
  try {
    console.log("📤 Recuperando datos desde KV Storage...");
    
    if (!env.audios) {
      throw new Error("KV Storage (audios) is not configured");
    }

    // 🔹 Leer desde KV
    const data = await env.audios.get("geminiResponse");

    if (!data) {
      return new Response(JSON.stringify({ error: "No data available" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    console.log("✅ Datos recuperados correctamente.");
    
    return new Response(data, {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("❌ Error obteniendo datos:", error.message);
    return new Response(JSON.stringify({ error: "Error fetching data", details: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}