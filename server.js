import express from "express";

const app = express();

app.use(express.json());

// Proxy para evitar bloqueios de CORS/referral do Instagram nas imagens/vídeos
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
    const hostLooter = "instagram-looter2.p.rapidapi.com";
    const hostBestExp = "instagram-best-experience.p.rapidapi.com";

    // 1. Puxa perfil e feed pela API Looter (que já sabemos que funciona 100%)
    const profileRes = await fetch(`https://${hostLooter}/profile?username=${encodeURIComponent(username)}`, {
      method: "GET",
      headers: {
        "x-rapidapi-host": hostLooter,
        "x-rapidapi-key": apiKey
      }
    });

    const apiData = await profileRes.json().catch(() => null);

    if (!profileRes.ok || !apiData) {
      return res.status(502).json({ error: "Não foi possível carregar o perfil." });
    }

    const user = apiData.data || apiData.user || apiData.result || apiData;

    if (!user || user.message === "Not found") {
      return res.status(404).json({ error: "Perfil não encontrado." });
    }

    const userId = user.id || user.pk || user.rest_id;
    const isPrivate = Boolean(user.is_private);

    // 2. Processa Posts do Feed
    let formattedPosts = [];
    const rawPosts = user.edge_owner_to_timeline_media?.edges || user.posts || user.media || [];

    if (Array.isArray(rawPosts) && rawPosts.length > 0) {
      formattedPosts = rawPosts.map((item, index) => {
        const node = item.node || item;
        const rawImg = node.display_url || node.display_src || node.image_url || node.thumbnail_src;
        return {
          id: node.id || `post_${index}`,
          image: proxify(rawImg),
          likes: node.edge_liked_by?.count ?? node.like_count ?? 0,
          comments: node.edge_media_to_comment?.count ?? node.comment_count ?? 0,
          caption: node.edge_media_to_caption?.edges?.[0]?.node?.text || node.caption || ""
        };
      });
    }

    // 3. Puxa os Stories na rota EXATA da Instagram Best Experience
    let formattedStories = [];
    if (!isPrivate && userId) {
      try {
        // Tentativa 1: Rota /user/stories (Padrão dessa API)
        let storiesRes = await fetch(`https://${hostBestExp}/user/stories?user_id=${userId}`, {
          method: "GET",
          headers: {
            "x-rapidapi-host": hostBestExp,
            "x-rapidapi-key": apiKey
          }
        });

        // Tentativa 2: Fallback se for /user-stories
        if (!storiesRes.ok) {
          storiesRes = await fetch(`https://${hostBestExp}/user-stories?user_id=${userId}`, {
            method: "GET",
            headers: {
              "x-rapidapi-host": hostBestExp,
              "x-rapidapi-key": apiKey
            }
          });
        }

        if (storiesRes.ok) {
          const storiesData = await storiesRes.json().catch(() => null);
          
          // Mapeia onde quer que a lista de stories esteja no JSON retornado
          const items = storiesData?.data?.items || storiesData?.data || storiesData?.items || storiesData?.reels || [];

          if (Array.isArray(items)) {
            formattedStories = items.map((story, i) => {
              const mediaUrl = 
                story.video_versions?.[0]?.url || 
                story.image_versions2?.candidates?.[0]?.url || 
                story.display_url || 
                story.image_url;

              return {
                id: story.id || `story_${i}`,
                type: story.video_versions ? "video" : "image",
                url: proxify(mediaUrl),
                time: "Ativo"
              };
            });
          }
        }
      } catch (e) {
        console.log("Erro ao carregar stories da API secundária:", e.message);
      }
    }

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
        postsCount: user.edge_owner_to_timeline_media?.count ?? user.media_count ?? formattedPosts.length,
        followersCount: user.edge_followed_by?.count ?? user.follower_count ?? 0,
        followingCount: user.edge_follow?.count ?? user.following_count ?? 0,
        isPrivate: isPrivate,
        isVerified: Boolean(user.is_verified)
      },
      stories: formattedStories,
      posts: isPrivate ? [] : formattedPosts
    });

  } catch (error) {
    console.error("Erro interno:", error);
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
