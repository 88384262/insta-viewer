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

    // Envia o nome de usuário nos parâmetros aceitos pela API
    const params = new URLSearchParams();
    params.append("username_or_url", username);

    const response = await fetch(`https://${apiHost}/get_ig_user_info_v2.php`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "x-rapidapi-host": apiHost,
        "x-rapidapi-key": apiKey
      },
      body: params.toString()
    });

    const apiData = await response.json().catch(() => null);

    if (!response.ok || !apiData) {
      console.error("Erro da RapidAPI:", response.status, apiData);
      return res.status(502).json({ error: "Não foi possível conectar à API de dados." });
    }

    // Extrai as informações recebidas
    const user = apiData.data || apiData.user || apiData.result || apiData;

    return res.json({
      success: true,
      profile: {
        username: user.username || username,
        fullName: user.full_name || user.fullName || user.username || username,
        biography: user.biography || "Sem biografia disponível.",
        profilePic: user.profile_pic_url_hd || user.profile_pic_url || user.profilePic || `https://ui-avatars.com/api/?name=${username}&background=833ab4&color=fff`,
        postsCount: user.media_count ?? user.postsCount ?? 0,
        followersCount: user.follower_count ?? user.followersCount ?? 0,
        followingCount: user.following_count ?? user.followingCount ?? 0,
        isPrivate: user.is_private || false,
        isVerified: user.is_verified || false
      },
      stories: [],
      posts: []
    });

  } catch (error) {
    console.error("Erro interno no servidor:", error);
    return res.status(500).json({ error: "Erro ao processar busca." });
  }
});

if (!process.env.VERCEL) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
  });
}

export default app;
