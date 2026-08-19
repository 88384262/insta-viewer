import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// Rota de consulta de perfil
app.get("/api/profile", async (req, res) => {
  const username = String(req.query.username || "").trim().replace(/^@/, "").toLowerCase();

  if (!username || !/^[a-z0-9._]{1,30}$/i.test(username)) {
    return res.status(400).json({ error: "Digite um nome de usuário válido do Instagram." });
  }

  // Se houver uma API integrada configurada nas variáveis de ambiente:
  if (process.env.API_URL) {
    try {
      const apiUrl = new URL(process.env.API_URL);
      apiUrl.searchParams.set("username", username);
      const response = await fetch(apiUrl, {
        headers: process.env.API_KEY ? { "Authorization": `Bearer ${process.env.API_KEY}` } : {}
      });
      if (response.ok) {
        const data = await response.json();
        return res.json(data);
      }
    } catch (e) {
      console.error("Erro na API externa:", e);
    }
  }

  // Dados demonstrativos com estrutura realista de perfil público
  const isPrivate = username.includes("private") || username.includes("fechado");

  return res.json({
    success: true,
    profile: {
      username: username,
      fullName: username.charAt(0).toUpperCase() + username.slice(1) + " (Oficial)",
      biography: "✨ Criador de Conteúdo\n📍 São Paulo, Brasil\n✉️ Contato via Direct",
      profilePic: `https://ui-avatars.com/api/?name=${encodeURIComponent(username)}&background=833ab4&color=fff&size=256`,
      postsCount: isPrivate ? 42 : 128,
      followersCount: 15400,
      followingCount: 380,
      isPrivate: isPrivate,
      isVerified: true
    },
    stories: isPrivate ? [] : [
      { id: "1", type: "image", url: "https://picsum.photos/400/710?random=1", time: "Há 2 horas" },
      { id: "2", type: "image", url: "https://picsum.photos/400/710?random=2", time: "Há 5 horas" },
      { id: "3", type: "image", url: "https://picsum.photos/400/710?random=3", time: "Há 12 horas" }
    ],
    posts: isPrivate ? [] : [
      { id: "p1", image: "https://picsum.photos/600/600?random=10", likes: 1240, comments: 45, caption: "Mais um dia produtivo! 🚀" },
      { id: "p2", image: "https://picsum.photos/600/600?random=11", likes: 2890, comments: 112, caption: "Fim de semana incrível. ☀️" },
      { id: "p3", image: "https://picsum.photos/600/600?random=12", likes: 950, comments: 28, caption: "Foco nos objetivos. 💪" },
      { id: "p4", image: "https://picsum.photos/600/600?random=13", likes: 3100, comments: 89, caption: "Novidades chegando em breve..." },
      { id: "p5", image: "https://picsum.photos/600/600?random=14", likes: 1750, comments: 62, caption: "Momentos especiais. 📸" },
      { id: "p6", image: "https://picsum.photos/600/600?random=15", likes: 4200, comments: 210, caption: "Obrigado a todos pelo apoio!" }
    ]
  });
});

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
  });
}

export default app;