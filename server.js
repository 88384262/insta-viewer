import express from "express";

const app = express();

app.use(express.json());
app.use(express.static("public")); // Para servir o index.html da pasta public

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
    const hostStories = "instagram-api-fast-reliable-data-scraper.p.rapidapi.com";

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

    const rawId = user.pk || user.id || user.rest_id || user.pk_id || "";
    const userId = String(rawId).replace(/\D/g, "");
    const isPrivate = Boolean(user.is_private);

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

    let formattedStories = [];

    if (!isPrivate) {
      const endpointsToTry = [];
      if (userId) {
        endpointsToTry.push(`https://${hostStories}/stories?user_id=${userId}`);
        endpointsToTry.push(`https://${hostStories}/user/stories?user_id=${userId}`);
      }
      endpointsToTry.push(`https://${hostStories}/stories?username=${encodeURIComponent(username)}`);

      for (const url of endpointsToTry) {
        try {
          const storiesRes = await fetch(url, {
            method: "GET",
            headers: {
              "x-rapidapi-host": hostStories,
              "x-rapidapi-key": apiKey
            }
          });

          if (storiesRes.ok) {
            const storiesData = await storiesRes.json().catch(() => null);
            const items = 
              storiesData?.items || 
              storiesData?.data?.items || 
              storiesData?.reels_media?.[0]?.items || 
              storiesData?.reels?.[0]?.items ||
              storiesData?.stories ||
              storiesData?.data || 
              storiesData?.result || 
              [];

            if (Array.isArray(items) && items.length > 0) {
              const parsed = items.map((story, i) => {
                const video = story.video_versions?.[0]?.url || story.video_url || story.download_url;
                const image = story.image_versions2?.candidates?.[0]?.url || story.display_url || story.image_url || story.thumbnail_url;
                const mediaUrl = video || image;

                return {
                  id: story.id || story.pk || `story_${i}`,
                  type: video ? "video" : "image",
                  url: proxify(mediaUrl),
                  time: "Ativo"
                };
              }).filter(s => Boolean(s.url));

              if (parsed.length > 0) {
                formattedStories = parsed;
                break;
              }
            }
          }
        } catch (e) {
          console.error("Erro stories:", e.message);
        }
      }
    }

    const rawProfilePic = user.profile_pic_url_hd || user.profile_pic_url || user.profilePic;
    const finalProfilePic = rawProfilePic ? proxify(rawProfilePic) : `https://ui-avatars.com/api/?name=${username}&background=833ab4&color=fff`;

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
