import { GoogleGenerativeAI } from "@google/generative-ai";

export async function POST(req, env) {
  try {
    console.log("📦 Received POST request");

    // 🔹 Validar que el KV esté disponible
    if (!env.PS_KV) {
      console.error("❌ AUDIOS KV namespace is not configured");
      return new Response(JSON.stringify({ error: "KV namespace not configured" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    // 🔹 Usar la API Key desde el secret
    const genAI = new GoogleGenerativeAI("AIzaSyBA8Dj4xZ2tLlcK9jZtvkjpf_qMZLKGp6U");

    // 🔹 Obtener los datos del formulario
    const formData = await req.formData();
    const file = formData.get("audio");

    if (!file) {
      console.error("❌ No file uploaded");
      return new Response(JSON.stringify({ error: "No file uploaded" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    console.log("📦 File received:", file.name, file.type, file.size, "bytes");

    // 🔹 Validar el tipo MIME del archivo
    const allowedMimeTypes = ["audio/webm", "audio/mp3", "audio/wav"];
    if (!allowedMimeTypes.includes(file.type)) {
      console.error("❌ Unsupported file type:", file.type);
      return new Response(JSON.stringify({ error: "Unsupported file type" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // 🔹 Convertir el archivo a Base64
    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const fileData = fileBuffer.toString("base64");

    // 🔹 Usar la API de Gemini para analizar el archivo
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    let result;
    try {
      console.log("📦 Sending data to Gemini API...");
      result = await model.generateContent([
        "Analyze the provided audio file and extract its content. First, summarize its main idea in a short sentence labeled as 'input'. Then, determine if the content is related to coding or programming. If it is, generate a high-level pseudocode solution labeled as 'output', ensuring it follows this exact structure:\n\n```\nBEGIN\n  [Describe the first step]\n  [Describe the second step]\n  IF [condition] THEN\n    [Action if true]\n  ELSE\n    [Action if false]\n  ENDIF\nEND\n```\n\nIdentify and list all variable names separately under 'variables'. Lastly, provide a brief constructive 'feedback' on the pseudocode. If the content is not related to coding or programming, return 'This is not relevant' as the output.",
        {
          inlineData: {
            data: fileData,
            mimeType: file.type,
          },
        },
      ]);
    } catch (apiError) {
      console.error("❌ Error calling Gemini API:", apiError.message);
      return new Response(JSON.stringify({ error: "Failed to process audio with Gemini API" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    console.log("📦 Gemini API response received");

    // 🔹 Validar la respuesta de Gemini
    if (!result || !result.response) {
      console.error("❌ Invalid Gemini API response:", result);
      return new Response(JSON.stringify({ error: "Invalid Gemini API response" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    const geminiOutput = result.response.text();

    // 🔹 Extraer partes relevantes del output
    const inputMatch = geminiOutput.match(/\*\*input:\*\* (.+)/);
    const outputMatch = geminiOutput.match(/\*\*output:\*\*\n([\s\S]+?)\n\n\*\*variables:/);
    const variablesMatch = geminiOutput.match(/\*\*variables:\*\*\n([\s\S]+?)\n\n\*\*feedback:/);
    const feedbackMatch = geminiOutput.match(/\*\*feedback:\*\*\n([\s\S]+)/);

    const jsonData = {
      input: inputMatch ? inputMatch[1].trim() : "No description available",
      output: outputMatch ? outputMatch[1].trim() : "No pseudocode generated",
      variables: variablesMatch ? variablesMatch[1].split("\n").map(v => v.trim()).filter(v => v !== "") : [],
      feedback: feedbackMatch ? feedbackMatch[1].trim() : "No feedback available",
    };

    // 🔹 Guardar en KV
    try {
      console.log("📦 Saving data to KV...");
      await env.PS_KV.put("geminiResponse", JSON.stringify(jsonData));
      console.log("📦 Data saved successfully");
    } catch (kvError) {
      console.error("❌ Error saving data to KV:", kvError.message);
      return new Response(JSON.stringify({ error: "Failed to save data to KV" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ message: "Processed successfully", response: jsonData }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("❌ Error processing the request:", error.message);
    return new Response(JSON.stringify({ error: "Internal server error", details: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

export async function GET(req, env) {
  try {
    console.log("📦 Fetching data from KV...");

    // 🔹 Validar que el KV esté disponible
    if (!env.PS_KV) {
      console.error("❌ AUDIOS KV namespace is not configured");
      return new Response(JSON.stringify({ error: "KV namespace not configured" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    // 🔹 Recuperar datos de KV
    let data;
    try {
      console.log("📦 Fetching key 'geminiResponse' from KV...");
      data = await env.PS_KV.get("geminiResponse");
      console.log("📦 Data fetched from KV:", data);
    } catch (kvError) {
      console.error("❌ Error fetching data from KV:", kvError.message);
      return new Response(JSON.stringify({ error: "Failed to fetch data from KV" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    // 🔹 Manejar el caso donde no hay datos disponibles
    if (!data) {
      console.warn("⚠️ No data found in KV for key 'geminiResponse'");
      return new Response(JSON.stringify({ error: "No data available" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    // 🔹 Validar que el dato sea un JSON válido
    try {
      console.log("📦 Validating JSON data...");
      const parsedData = JSON.parse(data);
      console.log("📦 JSON data is valid:", parsedData);
      return new Response(data, {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (parseError) {
      console.error("❌ Invalid JSON in KV:", parseError.message);
      return new Response(JSON.stringify({ error: "Invalid JSON in KV" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  } catch (error) {
    console.error("❌ Error fetching data:", error.message);
    return new Response(JSON.stringify({ error: "Internal server error", details: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}