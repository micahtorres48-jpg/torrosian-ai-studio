const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];

const views = {
  home: $("#homeView"),
  generate: $("#generateView"),
  designs: $("#designsView"),
  gallery: $("#galleryView"),
  styles: $("#stylesView"),
  placements: $("#placementsView"),
  settings: $("#settingsView")
};

function switchView(name) {
  const target = views[name] || views.home;
  Object.values(views).forEach(v => v?.classList.remove("active"));
  target.classList.add("active");
  $$("[data-view]").forEach(btn => btn.classList.toggle("active", btn.dataset.view === name));
  if (name === "designs") renderGallery();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

$$("[data-view]").forEach(btn => btn.addEventListener("click", () => switchView(btn.dataset.view)));
switchView("home");

$("#detail").addEventListener("input", e => $("#detailValue").textContent = `${e.target.value}%`);
$("#contrast").addEventListener("input", e => $("#contrastValue").textContent = `${e.target.value}%`);
$$("#quickIdeas button").forEach(btn => btn.addEventListener("click", () => { $("#prompt").value = btn.dataset.idea; $("#prompt").focus(); }));

let currentImage = "";

async function generate() {
  const description = $("#prompt").value.trim();
  if (!description) return alert("Describe the tattoo you want first.");

  const btn = $("#generateBtn");
  const original = btn.textContent;
  btn.disabled = true;
  btn.textContent = "Generating Your Concept...";

  try { 
const referenceFile = $("#referenceImage")?.files?.[0];
let referenceImage = null;

if (referenceFile) {
  referenceImage = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(referenceFile);
  });
}
    const response = await fetch("//generate-tattoo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        description,
        style: $("#style").value,
        placement: $("#placement").value,
        detail: $("#detail").value,
        contrast: $("#contrast").value,
        skinReady: $("#skinToggle").checked,
        stencilFriendly: $("#stencilToggle").checked,
        referenceImage  
      })
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Tattoo generation failed.");

    currentImage = data.image;
    $("#resultPanel").classList.remove("hidden");
    $("#artPlaceholder").innerHTML = `<img src="${data.image}" alt="Generated Torrosian tattoo concept">`;
    $("#resultTitle").textContent = "Your AI Tattoo Concept";
    $("#optimizedPrompt").textContent = `${description} — ${$("#style").value} — ${$("#placement").value}`;
    $("#resultPanel").scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (error) {
    alert(`Torrosian couldn't generate the tattoo.\n\n${error.message}`);
  } finally {
    btn.disabled = false;
    btn.textContent = original;
  }
}

$("#generateBtn").addEventListener("click", generate);
$("#regenerateBtn").addEventListener("click", async () => {
  const refinement = window.prompt(
    "What would you like to change about this tattoo?"
  );

  if (!refinement || !refinement.trim()) return;

  const descriptionBox = $("#prompt");
  const originalDescription = descriptionBox.value.trim();

  descriptionBox.value =
    `${originalDescription}\n\nRefinement request: ${refinement.trim()}`;

  await generate();
});
$("#copyBtn").addEventListener("click", async () => { await navigator.clipboard.writeText($("#optimizedPrompt").textContent); $("#copyBtn").textContent = "Copied"; setTimeout(() => $("#copyBtn").textContent = "Copy Prompt", 900); });

$("#saveBtn").addEventListener("click", () => {
  const img = $("#artPlaceholder img");
  if (!img) return alert("Generate a tattoo before saving.");

  const canvas = document.createElement("canvas");
  const maxWidth = 700;
  const scale = Math.min(1, maxWidth / img.naturalWidth);

  canvas.width = img.naturalWidth * scale;
  canvas.height = img.naturalHeight * scale;

  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  const savedImage = canvas.toDataURL("image/jpeg", 0.75);

  const design = {
    image: savedImage,
    id: Date.now(),
    title: $("#prompt").value.trim().slice(0, 55) || "Untitled design",
    style: $("#style").value,
    placement: $("#placement").value
  };

  const designs = JSON.parse(localStorage.getItem("torrosianDesigns") || "[]");
  designs.unshift(design);

  localStorage.setItem("torrosianDesigns", JSON.stringify(designs));

  $("#saveBtn").textContent = "Saved";
  renderGallery();

  setTimeout(() => $("#saveBtn").textContent = "Save", 900);
});

function escapeHtml(s) { return String(s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c])); }

function renderGallery() {
  const designs = JSON.parse(localStorage.getItem("torrosianDesigns") || "[]");
  const query = ($("#designSearch")?.value || "").toLowerCase();
  const filtered = designs.filter(d => `${d.title} ${d.style} ${d.placement}`.toLowerCase().includes(query));
  $("#emptyGallery").classList.toggle("hidden", filtered.length > 0);
  $("#designGrid").innerHTML = filtered.map(d => `
    <article class="design-card" data-design-id="${d.id}">
      <div class="design-thumb">${d.image ? `<img src="${d.image}" alt="${escapeHtml(d.title)}">` : ""}</div>
      <div class="design-info"><strong>${escapeHtml(d.title)}</strong><small>${escapeHtml(d.style)} · ${escapeHtml(d.placement)}</small></div>
      <button class="delete-design" data-delete-id="${d.id}">Delete</button>
      <a class="download-design" href="${d.image}" download="${escapeHtml(d.title || "torrosian-tattoo").replace(/[^a-z0-9]/gi, "-").toLowerCase()}.png">Download</a>
    </article>`).join("");
}

$("#designSearch").addEventListener("input", renderGallery);
$("#designGrid").addEventListener("click", e => {
  const deleteBtn = e.target.closest(".delete-design");

if (deleteBtn) {
  const deleteId = String(deleteBtn.dataset.deleteId);
  const designs = JSON.parse(localStorage.getItem("torrosianDesigns") || "[]");
  const updatedDesigns = designs.filter(d => String(d.id) !== deleteId);

  localStorage.setItem("torrosianDesigns", JSON.stringify(updatedDesigns));
  renderGallery();
  return;
}
  const card = e.target.closest(".design-card");
  if (!card) return;
  const designs = JSON.parse(localStorage.getItem("torrosianDesigns") || "[]");
  const design = designs.find(d => String(d.id) === card.dataset.designId); 
  if (!design?.image) return;
  $("#previewImage").src = design.image;
$("#previewTitle").textContent = design.title || "Tattoo Design";
$("#previewInfo").textContent = `${design.style || ""} · ${design.placement || ""}`;
$("#previewDownload").href = design.image;
$("#previewDownload").download = `${design.title || "torrosian-tattoo"}.png`;
$("#previewDelete").dataset.deleteId = design.id;
$("#previewRefine").dataset.designId = design.id;
$("#designPreviewModal").classList.remove("hidden");
});
$("#previewRefine").addEventListener("click", () => {
  const designId = $("#previewRefine").dataset.designId;
  const designs = JSON.parse(localStorage.getItem("torrosianDesigns") || "[]");
  const design = designs.find(d => String(d.id) === String(designId));

  if (!design) return;

  $("#prompt").value = design.title || "";
  $("#style").value = design.style || $("#style").value;
  $("#placement").value = design.placement || $("#placement").value;

  $("#designPreviewModal").classList.add("hidden");
  switchView("generate");
  window.scrollTo({ top: 0, behavior: "smooth" });
});
const styleOptions = ["Black & Grey Realism","Color Realism","Fine Line","Traditional","Neo-Traditional","Japanese","Chicano","Geometric","Lettering"];
const styleImages = {
  "Black & Grey Realism": "black-grey-realism.png",
  "Color Realism": "color-realism.png",
  "Fine Line": "fine-line.png",
  "Traditional": "traditional.png",
  "Neo-Traditional": "neo-traditional.png",
  "Japanese": "japanese.png",
  "Chicano": "chicano.png",
  "Geometric": "geometric.png",
  "Lettering": "lettering.png"
};

$("#styleCards").innerHTML = styleOptions.map(style => `
  <article class="option-card">
    <img
      class="style-card-image"
     src="./Images/torrosian-emblem.png/${styleImages[style]}"
      alt="${style}"
    >
    <h3>${style}</h3>
    <p>Use this direction when generating a new concept.</p>
    <button class="gold-btn" data-style="${style}">Use Style</button>
  </article>
`).join("");
$$("[data-style]").forEach(btn => btn.addEventListener("click", () => {
  $("#style").value = btn.dataset.style;
  switchView("generate");
  window.scrollTo({ top: 0, behavior: "smooth" });
}));

const placementOptions = ["Full Pec","Forearm","Upper Arm","Full Sleeve","Back","Neck","Hand","Thigh","Calf"];
$("#placementCards").innerHTML = placementOptions.map(p => `<article class="option-card"><h3>${p}</h3><p>Compose the concept around this body area.</p><button class="ghost-btn" data-placement="${p}">Use Placement</button></article>`).join("");
$$("[data-placement]").forEach(btn => btn.addEventListener("click", () => {
  $("#placement").value = btn.dataset.placement;
  switchView("generate");
  window.scrollTo({ top: 0, behavior: "smooth" });
}));

$("#saveSettingsBtn").addEventListener("click", () => {
  localStorage.setItem("torrosianDefaults", JSON.stringify({ style: $("#defaultStyle").value, placement: $("#defaultPlacement").value }));
  $("#style").value = $("#defaultStyle").value;
  $("#placement").value = $("#defaultPlacement").value;
  $("#saveSettingsBtn").textContent = "Saved";
  setTimeout(() => $("#saveSettingsBtn").textContent = "Save Settings", 900);
});

const savedDefaults = JSON.parse(localStorage.getItem("torrosianDefaults") || "null");
if (savedDefaults) {
  if (styleOptions.includes(savedDefaults.style)) $("#style").value = savedDefaults.style;
  if (placementOptions.includes(savedDefaults.placement)) $("#placement").value = savedDefaults.placement;
}
renderGallery();

$("#previewClose").addEventListener("click", () => {
  $("#designPreviewModal").classList.add("hidden");
});

$("#previewBackdrop").addEventListener("click", () => {
  $("#designPreviewModal").classList.add("hidden");
});


$("#previewDelete").addEventListener("click", () => {
  const id = $("#previewDelete").dataset.deleteId;
  if (!id) return;

  const designs = JSON.parse(localStorage.getItem("torrosianDesigns") || "[]");
  const updatedDesigns = designs.filter(d => String(d.id) !== String(id));

  localStorage.setItem("torrosianDesigns", JSON.stringify(updatedDesigns));
  $("#designPreviewModal").classList.add("hidden");
  renderGallery();
});

const createAccountBtn = document.querySelector("#createAccountBtn");

if (createAccountBtn) {
  createAccountBtn.addEventListener("click", async () => {
    const email = document.querySelector("#accountEmail").value.trim();
    const password = document.querySelector("#accountPassword").value;

    if (!email || !password) {
      alert("Please enter an email and password.");
      return;
    }

    try {
      const response = await fetch("//signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        alert(data.error || "Could not create account.");
        return;
      }

      alert("Account created successfully. Check your email if confirmation is required.");
    } catch (error) {
      console.error("Create account error:", error);
      alert("Could not connect to the account server.");
    }
  });
}

const emailLoginBtn = document.querySelector("#emailLoginBtn");

if (emailLoginBtn) {
  emailLoginBtn.addEventListener("click", async () => {
    const email = document.querySelector("#accountEmail").value.trim();
    const password = document.querySelector("#accountPassword").value;

    if (!email || !password) {
      alert("Please enter your email and password.");
      return;
    }

    try {
      const response = await fetch("//login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        alert(data.error || "Could not sign in.");
        return;
      }

      localStorage.setItem("torrosianSession", JSON.stringify(data.session));
localStorage.setItem("torrosianUser", JSON.stringify(data.user));

alert("Signed in successfully!");
    } catch (error) {
      console.error("Sign in error:", error);
      alert("Could not connect to the account server.");
    }
  });
}
const savedUser = JSON.parse(localStorage.getItem("torrosianUser") || "null");
const savedSession = JSON.parse(localStorage.getItem("torrosianSession") || "null");

if (savedUser && savedSession) {
  const emailInput = document.querySelector("#accountEmail");
  const passwordInput = document.querySelector("#accountPassword");
  const signInButton = document.querySelector("#emailLoginBtn");
  const createButton = document.querySelector("#createAccountBtn");

  if (emailInput) {
    emailInput.value = savedUser.email || "";
    emailInput.disabled = true;
  }

  if (passwordInput) {
    passwordInput.value = "";
    passwordInput.disabled = true;
  }

  if (signInButton) {
    signInButton.textContent = "Signed In";
    signInButton.disabled = true;
  }

  if (createButton) {
    createButton.style.display = "none";
  }
}

const signOutBtn = document.querySelector("#signOutBtn");

if (signOutBtn) {
  signOutBtn.addEventListener("click", () => {
    localStorage.removeItem("torrosianSession");
    localStorage.removeItem("torrosianUser");
    window.location.reload();
  });
}

if (savedUser && savedSession && signOutBtn) {
  signOutBtn.style.display = "inline-flex";
}

const googleLoginBtn = document.querySelector("#googleLoginBtn");

if (googleLoginBtn) {
  googleLoginBtn.addEventListener("click", async () => {
    try {
      const response = await fetch("//auth/google");
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Google sign-in failed.");
      }

      if (data.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      alert(error.message);
    }
  });
}
async function startStripeCheckout(plan) {
  try {
    const savedSession = JSON.parse(
  localStorage.getItem("torrosianSession") || "null"
);

const accessToken = savedSession?.access_token;

if (!accessToken) {
  alert("Please sign in before choosing a paid plan.");
  return;
}
    const response = await fetch(
      "//create-checkout-session",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ plan }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Unable to start checkout.");
    }

    if (data.url) {
      window.location.href = data.url;
    }
  } catch (error) {
    alert(error.message);
  }
}
const upgradePlanBtn = document.querySelector("#goldPlanBtn");

if (upgradePlanBtn) {
  upgradePlanBtn.addEventListener("click", () => {
    startStripeCheckout("gold");
  });
}

const platinumPlanBtn = document.querySelector("#platinumPlanBtn");

if (platinumPlanBtn) {
  platinumPlanBtn.addEventListener("click", () => {
    startStripeCheckout("platinum");
  });
}