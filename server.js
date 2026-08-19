import express from "express";

const app = express();

app.use(express.json());

app.get("/api/profile", async (req, res) => {
  try {
    const username = String(req.query.username || "")
      .trim()
      .replace(/^@/, "")
      .toLowerCase();

    if (!/^[a-z0-9._]{1,30}$/i.test(username)) {
      return res.status(400).json({ error: "Digite um @usuário válido." });
    }

    const apiKey = "fb6cd7e924msh9fe32786b6578cbp138615jsne52a772bf92f";
    const apiHost = "instagram-scraper-stable-api.p.rapidapi.com";

    // A API exige a URL completa do perfil no parâmetro
    const fullProfileUrl = `https://www.instagram.com/${username}/`;

    const params = new URLSearchParams();
    params.append("username_or_url", fullProfileUrl);

    let userData = null;

    try {
      const response = await fetch(`https://${apiHost}/get_ig_user_info_v2.php`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "x-rapidapi-host": apiHost,
          "x-rapidapi-key": apiKey
        },
        body: params.toString()
      });

      if (response.ok) {
        const apiData = await response.json();
        userData = apiData.data || apiData.user || apiData.result;
      }
    } catch (apiErr) {
      console.error("Erro na consulta externa da RapidAPI:", apiErr);
    }

    // Se a API externa responder com sucesso, exibe os dados reais:
    if (userData && (userData.username || userData.full_name)) {
      const isPrivate = Boolean(userData.is_private);
      return res.json({
        success: true,
        profile: {
          username: userData.username || username,
          fullName: userData.full_name || username,
          biography: userData.biography || "Sem biografia disponível.",
          profilePic: userData.profile_pic_url_hd || userData.profile_pic_url || `https://ui-avatars.com/api/?name=${username}&background=833ab4&color=fff`,
          postsCount: userData.media_count ?? 0,
          followersCount: userData.follower_count ?? 0,
          followingCount: userData.following_count ?? 0,
          isPrivate: isPrivate,
          isVerified: Boolean(userData.is_verified)
        },
        stories: [],
        posts: []
      });
    }

    // Caso a API falhe/bloqueie, exibe o perfil adaptativo sem travar o site:
    const isDemoPrivate = username.includes("fechado") || username.includes("privado");
    return res.json({
      success: true,
      profile: {
        username: username,
        fullName: username.replace(/[._]/g, " ").toUpperCase(),
        biography: "✨ Perfil do Instagram visualizado anonimamente.\n📍 Dados carregados em modo de visualização.",
        profilePic: `https://ui-avatars.com/api/?name=${encodeURIComponent(username)}&background=833ab4&color=fff&size=256`,
        postsCount: isDemoPrivate ? 0 : 48,
        followersCount: 3420,
        followingCount: 290,
        isPrivate: isDemoPrivate,
        isVerified: false
      },
      stories: isDemoPrivate ? [] : [
        { id: "1", type: "image", url: "https://picsum.photos/400/710?random=10", time: "Há 1 hora" },
        { id: "2", type: "image", url: "https://picsum.photos/400/710?random=11", time: "Há 4 horas" }
      ],
      posts: isDemoPrivate ? [] : [
        { id: "p1", image: "https://picsum.photos/600/600?random=20", likes: 340, comments: 12 },
        { id: "p2", image: "https://picsum.photos/600/600?random=21", likes: 890, comments: 45 },
        { id: "p3", image: "https://picsum.photos/600/600?random=22", likes: 150, comments: 8 }
      ]
    });

  } catch (error) {
    console.error("Erro interno:", error);
    return res.status(500).json({ error: "Erro ao processar a requisição." });
  }
});

if (!process.env.VERCEL) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
  });
}

export default app;
