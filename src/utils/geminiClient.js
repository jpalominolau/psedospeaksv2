export async function uploadAndProcessAudio(file) {
  const formData = new FormData();
  formData.append("audio", file); // 🔹 Ahora coincide con el backend

  try {
    const response = await fetch("/api/upload", {
      method: "POST",
      body: formData,
    });
    
    if (!response.ok) {
      throw new Error("Failed to upload and process audio.");
    }

    const data = await response.json();
    return data.response; // 🔹 Ahora devuelve la respuesta procesada correctamente
  } catch (error) {
    console.error("Error sending audio:", error);
    throw error;
  }
}

// 🔹 Nueva función corregida para obtener la última respuesta guardada
export async function getLatestGeminiResponse() {
  try {
    const response = await fetch("/api/upload");

    if (!response.ok) {
      if (response.status === 404) return null; // 🔹 Manejo de error si no hay datos aún
      throw new Error("Failed to fetch latest Gemini response.");
    }

    return await response.json();
  } catch (error) {
    console.error("Error fetching latest response:", error);
    return null;
  }
}
