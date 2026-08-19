import express from "express";

const app = express();

app.use(express.json());

// Função para bypassar o bloqueio de imagem do Instagram usando Proxy seguro
const proxify = (url) => {
  if (!url || typeof url !== "string") return "";
  if (url.includes("ui-avatars.com")) return url;
  return `https://images.weserv.nl/?url=${encodeURIComponent(url)}&default=ssl`;
};

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
    const apiHost = "instagram-looter2.p.rapidapi.com";

    // Busca o perfil completo
    const response = await fetch(`https://${apiHost}/profile?username=${encodeURIComponent(username)}`, {
      method: "GET",
      headers: {
        "x-rapidapi-host": apiHost,
        "x-rapidapi-key": apiKey
      }
    });

    const apiData = await response.json().catch(() => null);

    if (!response.ok || !apiData) {
      console.error("Erro da RapidAPI:", response.status, apiData);
      return res.status(502).json({ error: "Não foi possível carregar os dados do perfil." });
    }

    const user = apiData.data || apiData.user || apiData.result || apiData;

    if (!user || user.message === "Not found") {
      return res.status(404).json({ error: "Perfil não encontrado no Instagram." });
    }

    // Processa os posts reais se existirem
    let formattedPosts = [];
    const rawPosts = user.edge_owner_to_timeline_media?.edges || user.posts || user.media || [];

    if (Array.isArray(rawPosts) && rawPosts.length > 0) {
      formattedPosts = rawPosts.map((item, index) => {
        const node = item.node || item;
        const rawImg = node.display_url || node.display_src || node.image_url || node.thumbnail_src;
        return {
          id: node.id || `post_${index}`,
          image: proxify(rawImg),
          likes: node.edge_liked_by?.count ?? node.like_count ?? node.likesCount ?? 0,
          comments: node.edge_media_to_comment?.count ?? node.comment_count ?? node.commentsCount ?? 0,
          caption: node.edge_media_to_caption?.edges?.[0]?.node?.text || node.caption || ""
        };
      });
    }

    // Processa os stories reais
    let formattedStories = [];
    const rawStories = user.stories || user.reels || user.story_items || [];

    if (Array.isArray(rawStories) && rawStories.length > 0) {
      formattedStories = rawStories.map((story, index) => ({
        id: story.id || `story_${index}`,
        type: story.is_video ? "video" : "image",
        url: proxify(story.display_url || story.image_url || story.video_url || story.media_url),
        time: "Há poucas horas"
      }));
    }

    // Foto de perfil original usando o Proxy para não quebrar
    const rawProfilePic = user.profile_pic_url_hd || user.profile_pic_url || user.profilePic;
    const finalProfilePic = rawProfilePic 
      ? proxify(rawProfilePic) 
      : `https://ui-avatars.com/api/?name=${username}&background=833ab4&color=fff`;

    return res.json({
      success: true,
      profile: {
        username: user.username || username,
        fullName: user.full_name || user.fullName || user.username || username,
        biography: user.biography || "Sem biografia.",
        profilePic: finalProfilePic,
        postsCount: user.edge_owner_to_timeline_media?.count ?? user.media_count ?? user.postsCount ?? formattedPosts.length,
        followersCount: user.edge_followed_by?.count ?? user.follower_count ?? user.followersCount ?? 0,
        followingCount: user.edge_follow?.count ?? user.following_count ?? user.followingCount ?? 0,
        isPrivate: Boolean(user.is_private),
        isVerified: Boolean(user.is_verified)
      },
      stories: formattedStories,
      posts: user.is_private ? [] : formattedPosts
    });

  } catch (error) {
    console.error("Erro interno no servidor:", error);
    return res.status(500).json({ error: "Erro ao processar busca no servidor." });
  }
});

if (!process.env.VERCEL) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
  });
}

export default app;
