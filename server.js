import express from "express";

const app = express();

app.use(express.json());

// Proxy para evitar o bloqueio de imagem/vídeo do Instagram no navegador
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
    const apiHost = "instagram-best-experience.p.rapidapi.com";

    // 1. Busca os dados do perfil pelo username
    const profileRes = await fetch(`https://${apiHost}/user/profile-by-username?username=${encodeURIComponent(username)}`, {
      method: "GET",
      headers: {
        "x-rapidapi-host": apiHost,
        "x-rapidapi-key": apiKey
      }
    });

    const profileData = await profileRes.json().catch(() => null);

    if (!profileRes.ok || !profileData) {
      return res.status(502).json({ error: "Não foi possível carregar o perfil." });
    }

    const user = profileData.data || profileData.user || profileData.result || profileData;

    if (!user || user.message === "Not found") {
      return res.status(404).json({ error: "Perfil não encontrado no Instagram." });
    }

    const userId = user.id || user.pk || user.user_id;
    const isPrivate = Boolean(user.is_private);

    // 2. Busca Stories e Feed em paralelo (se o perfil for público)
    let formattedStories = [];
    let formattedPosts = [];

    if (!isPrivate && userId) {
      const [storiesRes, feedRes] = await Promise.allSettled([
        fetch(`https://${apiHost}/user/stories?user_id=${userId}`, {
          headers: { "x-rapidapi-host": apiHost, "x-rapidapi-key": apiKey }
        }),
        fetch(`https://${apiHost}/user/feed?user_id=${userId}`, {
          headers: { "x-rapidapi-host": apiHost, "x-rapidapi-key": apiKey }
        })
      ]);

      // Processa os Stories retornados
      if (storiesRes.status === "fulfilled" && storiesRes.value.ok) {
        const storiesData = await storiesRes.value.json().catch(() => null);
        const storyItems = storiesData?.data || storiesData?.items || storiesData?.result || [];

        if (Array.isArray(storyItems)) {
          formattedStories = storyItems.map((story, i) => {
            const mediaUrl = story.video_versions?.[0]?.url || story.image_versions2?.candidates?.[0]?.url || story.display_url || story.image_url;
            return {
              id: story.id || `story_${i}`,
              type: story.video_versions ? "video" : "image",
              url: proxify(mediaUrl),
              time: "Ativo"
            };
          });
        }
      }

      // Processa os Posts do Feed
      if (feedRes.status === "fulfilled" && feedRes.value.ok) {
        const feedData = await feedRes.value.json().catch(() => null);
        const feedItems = feedData?.data || feedData?.items || feedData?.edges || [];

        if (Array.isArray(feedItems)) {
          formattedPosts = feedItems.map((item, i) => {
            const node = item.node || item;
            const img = node.image_versions2?.candidates?.[0]?.url || node.display_url || node.image_url;
            return {
              id: node.id || `post_${i}`,
              image: proxify(img),
              likes: node.like_count ?? node.edge_liked_by?.count ?? 0,
              comments: node.comment_count ?? node.edge_media_to_comment?.count ?? 0,
              caption: node.caption?.text || node.edge_media_to_caption?.edges?.[0]?.node?.text || ""
            };
          });
        }
      }
    }

    // Se o perfil for público e o endpoint de feed não trouxer nada, usa o fallback de mídia do perfil
    if (formattedPosts.length === 0 && !isPrivate) {
      const rawPosts = user.edge_owner_to_timeline_media?.edges || [];
      formattedPosts = rawPosts.map((item, index) => {
        const node = item.node || item;
        return {
          id: node.id || `post_${index}`,
          image: proxify(node.display_url || node.thumbnail_src),
          likes: node.edge_liked_by?.count ?? 0,
          comments: node.edge_media_to_comment?.count ?? 0,
          caption: node.edge_media_to_caption?.edges?.[0]?.node?.text || ""
        };
      });
    }

    const rawProfilePic = user.profile_pic_url_hd || user.profile_pic_url;
    const finalProfilePic = rawProfilePic 
      ? proxify(rawProfilePic) 
      : `https://ui-avatars.com/api/?name=${username}&background=833ab4&color=fff`;

    return res.json({
      success: true,
      profile: {
        username: user.username || username,
        fullName: user.full_name || user.username || username,
        biography: user.biography || "Sem biografia.",
        profilePic: finalProfilePic,
        postsCount: user.media_count ?? user.edge_owner_to_timeline_media?.count ?? formattedPosts.length,
        followersCount: user.follower_count ?? user.edge_followed_by?.count ?? 0,
        followingCount: user.following_count ?? user.edge_follow?.count ?? 0,
        isPrivate: isPrivate,
        isVerified: Boolean(user.is_verified)
      },
      stories: formattedStories,
      posts: isPrivate ? [] : formattedPosts
    });

  } catch (error) {
    console.error("Erro interno no servidor:", error);
    return res.status(500).json({ error: "Erro interno no servidor." });
  }
});

if (!process.env.VERCEL) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
  });
}

export default app;
