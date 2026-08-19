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

    // --- DADOS DA RAPIDAPI DEFINIDOS DIRETO NO CÓDIGO ---
    const apiKey = "fb6cd7e924msh9fe32786b6578cbp138615jsne52a772bf92f";
    const apiHost = "instagram-scraper-stable-api.p.rapidapi.com";

    // Prepara os parâmetros no formato do formulário esperado pela API
    const params = new URLSearchParams();
    params.append("username_or_url", username);

    // Faz a chamada POST para a RapidAPI
    const response = await fetch(`https://${apiHost}/get_ig_user_info_v2.php`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "x-rapidapi-host": apiHost,
        "x-rapidapi-key": apiKey
      },
      body: params.toString()
    });

    if (!response.ok) {
      console.error("Erro na resposta da RapidAPI:", response.status, response.statusText);
      return res.status(502).json({ error: "O provedor de dados não respondeu corretamente." });
    }

    const apiData = await response.json();

    // Mapeia o retorno da API para a interface
    const profile = apiData.data || apiData.user || {};

    return res.json({
      success: true,
      profile: {
        username: profile.username || username,
        fullName: profile.full_name || profile.fullName || username,
        biography: profile.biography || "Sem biografia.",
        profilePic: profile.profile_pic_url || profile.profilePic || `https://ui-avatars.com/api/?name=${username}&background=833ab4&color=fff`,
        postsCount: profile.media_count || profile.postsCount || 0,
        followersCount: profile.follower_count || profile.followersCount || 0,
        followingCount: profile.following_count || profile.followingCount || 0,
        isPrivate: profile.is_private || false,
        isVerified: profile.is_verified || false
      },
      stories: [],
      posts: []
    });

  } catch (error) {
    console.error("Erro interno no servidor:", error);
    return res.status(500).json({ error: "Erro ao consultar a API externa do Instagram." });
  }
});

if (!process.env.VERCEL) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
  });
}

export default app;
