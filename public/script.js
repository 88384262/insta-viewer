document.addEventListener("DOMContentLoaded", () => {
  const searchForm = document.querySelector("#searchForm");
  const usernameInput = document.querySelector("#usernameInput");
  const loader = document.querySelector("#loader");
  const errorMessage = document.querySelector("#errorMessage");
  const profileResult = document.querySelector("#profileResult");

  const mediaModal = document.querySelector("#mediaModal");
  const modalImg = document.querySelector("#modalImg");
  const downloadBtn = document.querySelector("#downloadBtn");
  const closeModal = document.querySelector("#closeModal");

  // Botões de exemplo
  document.querySelectorAll(".ex-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      usernameInput.value = btn.dataset.user;
      fetchProfile(btn.dataset.user);
    });
  });

  // Troca de Abas
  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
      document.querySelectorAll(".tab-content").forEach(c => c.classList.add("hidden"));

      btn.classList.add("active");
      const targetTab = document.getElementById(btn.dataset.tab);
      if (targetTab) targetTab.classList.remove("hidden");
    });
  });

  // Envío do Formulário
  searchForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const username = usernameInput.value.trim();
    if (username) fetchProfile(username);
  });

  // Modal Fechar
  closeModal.addEventListener("click", () => mediaModal.classList.add("hidden"));
  mediaModal.addEventListener("click", (e) => {
    if (e.target === mediaModal) mediaModal.classList.add("hidden");
  });

  async function fetchProfile(username) {
    showLoader();
    try {
      const res = await fetch(`/api/profile?username=${encodeURIComponent(username)}`);
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Não foi possível carregar o perfil.");
      }

      renderProfile(data);
    } catch (err) {
      showError(err.message);
    } finally {
      hideLoader();
    }
  }

  function renderProfile(data) {
    const p = data.profile;
    
    document.querySelector("#profilePic").src = p.profilePic;
    document.querySelector("#usernameHeader").textContent = `@${p.username}`;
    document.querySelector("#fullName").textContent = p.fullName;
    document.querySelector("#biography").textContent = p.biography;
    document.querySelector("#postsCount").textContent = formatNumber(p.postsCount);
    document.querySelector("#followersCount").textContent = formatNumber(p.followersCount);
    document.querySelector("#followingCount").textContent = formatNumber(p.followingCount);

    const privacyBadge = document.querySelector("#privacyBadge");
    const privateNotice = document.querySelector("#privateNotice");
    const publicContent = document.querySelector("#publicContent");

    if (p.isPrivate) {
      privacyBadge.textContent = "🔒 Privado";
      privacyBadge.classList.add("private");
      privateNotice.classList.remove("hidden");
      publicContent.classList.add("hidden");
    } else {
      privacyBadge.textContent = "Público";
      privacyBadge.classList.remove("private");
      privateNotice.classList.add("hidden");
      publicContent.classList.remove("hidden");

      renderStories(data.stories || []);
      renderPosts(data.posts || []);
    }

    errorMessage.classList.add("hidden");
    profileResult.classList.remove("hidden");
  }

  function renderStories(stories) {
    const grid = document.querySelector("#storiesGrid");
    document.querySelector("#storiesBadgeCount").textContent = stories.length;
    grid.innerHTML = "";

    if (stories.length === 0) {
      grid.innerHTML = `<div class="empty-state">Nenhum story ativo nas últimas 24 horas.</div>`;
      return;
    }

    stories.forEach(story => {
      const card = document.createElement("div");
      card.className = "story-card";
      card.innerHTML = `
        <img src="${story.url}" alt="Story" />
        <span class="story-time">${story.time}</span>
      `;
      card.addEventListener("click", () => openModal(story.url));
      grid.appendChild(card);
    });
  }

  function renderPosts(posts) {
    const grid = document.querySelector("#postsGrid");
    document.querySelector("#postsBadgeCount").textContent = posts.length;
    grid.innerHTML = "";

    if (posts.length === 0) {
      grid.innerHTML = `<div class="empty-state">Nenhuma publicação encontrada neste perfil.</div>`;
      return;
    }

    posts.forEach(post => {
      const card = document.createElement("div");
      card.className = "post-card";
      card.innerHTML = `
        <img src="${post.image}" alt="Publicação" />
        <div class="post-overlay">
          <span>❤️ ${formatNumber(post.likes)}</span>
          <span>💬 ${formatNumber(post.comments)}</span>
        </div>
      `;
      card.addEventListener("click", () => openModal(post.image));
      grid.appendChild(card);
    });
  }

  function openModal(imgUrl) {
    modalImg.src = imgUrl;
    downloadBtn.href = imgUrl;
    mediaModal.classList.remove("hidden");
  }

  function showLoader() {
    loader.classList.remove("hidden");
    errorMessage.classList.add("hidden");
    profileResult.classList.add("hidden");
  }

  function hideLoader() {
    loader.classList.add("hidden");
  }

  function showError(msg) {
    errorMessage.textContent = msg;
    errorMessage.classList.remove("hidden");
    profileResult.classList.add("hidden");
  }

  function formatNumber(num) {
    if (num === null || num === undefined) return "0";
    return new Intl.NumberFormat("pt-BR", { notation: "compact" }).format(num);
  }
});
