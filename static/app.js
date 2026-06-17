const $ = (selector) => document.querySelector(selector);

function optionalButton(selector) {
  const button = $(selector);
  if (button) return button;
  return {
    disabled: false,
    textContent: "",
    addEventListener() {},
    classList: {
      add() {},
      remove() {},
      toggle() {
        return false;
      },
    },
  };
}

function optionalControl(selector, fallbackValue = "") {
  const control = $(selector);
  if (control) return control;
  return {
    value: fallbackValue,
    checked: false,
    disabled: false,
    addEventListener() {},
  };
}

const songFile = $("#songFile");
const songName = $("#songName");
const songWave = $("#songWave");
const refreshProjectsButton = $("#refreshProjectsButton");
const projectVaultDetails = $("#projectVaultDetails");
const projectVaultSummary = $("#projectVaultSummary");
const projectList = $("#projectList");
const projectStatus = $("#projectStatus");
const splitButton = optionalButton("#splitButton");
const harmonyButton = optionalButton("#harmonyButton");
const splitStatus = $("#splitStatus");
const stemTracks = $("#stemTracks");
const songAudio = $("#songAudio");
const backingAudio = $("#backingAudio");
const acapellaAudio = $("#acapellaAudio");
const acapellaWrap = $("#acapellaWrap");
const leadWrap = $("#leadWrap");
const harmonyWrap = $("#harmonyWrap");
const leadAudio = $("#leadAudio");
const harmonyAudio = $("#harmonyAudio");
const stemPlayButton = optionalButton("#stemPlayButton");
const stemSeek = optionalControl("#stemSeek", "0");
const stemCurrent = $("#stemCurrent");
const stemDurationLabel = $("#stemDuration");
const stemActiveLabel = $("#stemActiveLabel");
const stemTrackButtons = Array.from(document.querySelectorAll("[data-stem-track]"));
const downloadLeadStem = $("#downloadLeadStem");
const downloadBackingStem = $("#downloadBackingStem");
const lyricsInput = $("#lyricsInput");
const lyricArtist = $("#lyricArtist");
const lyricTitle = $("#lyricTitle");
const searchLyricsButton = optionalButton("#searchLyricsButton");
const autoLyricsButton = optionalButton("#autoLyricsButton");
const scanLyricsButton = optionalButton("#scanLyricsButton");
const visualPlanButton = optionalButton("#visualPlanButton");
const studioAutoButton = $("#studioAutoButton");
const studioAutoStatus = $("#studioAutoStatus");
const screenRatio = $("#screenRatio");
const lyricStyle = optionalControl("#lyricStyle", "karaoke");
const scanSpeed = optionalControl("#scanSpeed", "1");
const animationMode = optionalControl("#animationMode", "auto");
const motionIntensity = optionalControl("#motionIntensity", "1");
const contentStatus = $("#contentStatus");
const pixelScreen = $("#pixelScreen");
const previewMvButton = optionalButton("#previewMvButton");
const exportMvButton = $("#exportMvButton");
const downloadMv = $("#downloadMv");
const mvStatus = $("#mvStatus");
const pipelineStepMap = Object.fromEntries(
  Array.from(document.querySelectorAll("[data-pipeline-step]")).map((node) => [node.dataset.pipelineStep, node]),
);
const recordButton = $("#recordButton");
const skipIntroRecordButton = $("#skipIntroRecordButton");
const stopRecordButton = $("#stopRecordButton");
const redoRecordButton = $("#redoRecordButton");
const recordClock = $("#recordClock");
const monitorBacking = $("#monitorBacking");
const recordedAudio = $("#recordedAudio");
const downloadTake = $("#downloadTake");
const recordStatus = $("#recordStatus");
const playMixButton = $("#playMixButton");
const mixSeek = $("#mixSeek");
const mixCurrent = $("#mixCurrent");
const mixDurationLabel = $("#mixDuration");
const autoAlignButton = $("#autoAlignButton");
const alignmentWaveform = $("#alignmentWaveform");
const alignmentCtx = alignmentWaveform?.getContext("2d");
const alignmentStatus = $("#alignmentStatus");
const vocalOffset = $("#vocalOffset");
const offsetOut = $("#offsetOut");
const mixBackingEnabled = $("#mixBackingEnabled");
const backingGain = $("#backingGain");
const vocalGain = $("#vocalGain");
const backingGainOut = $("#backingGainOut");
const vocalGainOut = $("#vocalGainOut");
const presetGrid = $("#presetGrid");
const mixStatus = $("#mixStatus");
const pixelFrontScreen = $("#pixelFrontScreen");
const pixelFrontCtx = pixelFrontScreen?.getContext("2d");
const pixelSongFile = $("#pixelSongFile");
const pixelDropzone = $("#pixelDropzone");
const pixelSongLabel = $("#pixelSongLabel");
const pixelArtistInput = $("#pixelArtistInput");
const pixelTitleInput = $("#pixelTitleInput");
const pixelMakeButton = $("#pixelMakeButton");
const pixelFrontStatus = $("#pixelFrontStatus");
const pixelDeckMode = $("#pixelDeckMode");
const pixelDeckReady = $("#pixelDeckReady");
const pixelDisc = $("#pixelDisc");
const pixelRecordButton = $("#pixelRecordButton");
const pixelPlayButton = $("#pixelPlayButton");
const pixelStyleButton = $("#pixelStyleButton");
const showPixelFrontButton = $("#showPixelFrontButton");
const showStudioBackButton = $("#showStudioBackButton");
const pixelStepMap = Object.fromEntries(
  Array.from(document.querySelectorAll("[data-pixel-step]")).map((node) => [node.dataset.pixelStep, node]),
);

const ctx2d = pixelScreen.getContext("2d");
ctx2d.imageSmoothingEnabled = false;

const state = {
  capabilities: {},
  songFile: null,
  songObjectUrl: "",
  jobId: "",
  projectGeneration: 0,
  projectCreatePromise: null,
  separationPollTimer: 0,
  saveTimer: null,
  loadingProject: false,
  backingUrl: "",
  acapellaUrl: "",
  leadUrl: "",
  harmonyUrl: "",
  recorder: null,
  micStream: null,
  recordChunks: [],
  recordStartedAt: 0,
  recordTimelineStart: 0,
  recordTimer: null,
  recordedBlob: null,
  recordedUrl: "",
  savedTakeUrl: "",
  audioCtx: null,
  backingBuffer: null,
  backingBufferUrl: "",
  alignmentReferenceBuffer: null,
  alignmentReferenceUrl: "",
  alignmentReferenceLabel: "",
  alignmentReferenceEnvelope: null,
  alignmentVocalEnvelope: null,
  alignmentLastResult: null,
  acapellaBuffer: null,
  acapellaBufferUrl: "",
  acapellaSegments: null,
  acapellaSegmentsUrl: "",
  vocalBuffer: null,
  vocalBufferKey: "",
  activePreset: "studio",
  activeGraph: null,
  mixPosition: 0,
  mixRaf: 0,
  mixSeeking: false,
  activeStemTrack: "original",
  stemPosition: 0,
  stemRaf: 0,
  stemSeeking: false,
  visualPreview: null,
  exportSession: null,
  lyricCues: [],
  lyricsMeta: null,
  visualPlan: null,
  visualPlanKey: "",
  waveformProfile: null,
  contentProfile: null,
  contentProfileKey: "",
  mediaInvalidationSuppressedUntil: 0,
  currentTitle: "Pixel OK",
  viewMode: "pixel",
  pixelWorkflowRunning: false,
  pixelWorkflowMessage: "",
  pixelWorkflowError: "",
  tuneMode: "standard",
};

const presets = {
  clean: { hp: 75, shelf: 0.5, comp: [-18, 2.1], delay: 0, delayGain: 0, drive: 0 },
  studio: { hp: 105, shelf: 3.1, comp: [-25, 3.6], delay: 0.085, delayGain: 0.055, drive: 0.025 },
  air: { hp: 120, shelf: 5.2, comp: [-21, 2.6], delay: 0.075, delayGain: 0.035, drive: 0 },
  tape: { hp: 85, shelf: -1.2, comp: [-17, 2.0], delay: 0.13, delayGain: 0.03, drive: 0.18 },
  live: { hp: 105, shelf: 2.0, comp: [-27, 4.1], delay: 0.18, delayGain: 0.12, drive: 0.04 },
};

const proceduralLayouts = ["radial", "diagonal", "tunnel", "constellation", "stacked", "fluid", "split-screen"];
const abstractThemeFamilies = new Set(["abstract-wave", "waveform", "orbit", "voice-ribbon", "light-grid", "wave-tunnel"]);
const semanticThemeFamilies = new Set(["horror-pop", "romance-pop", "dance-pop", "cosmic-world", "rain-memory", "lonely-night", "urban-night", "urban-stage", "song-stage"]);
const themeKeywordSets = [
  ["horror-pop", ["thriller", "ghost", "ghoul", "wolf", "werewolf", "zombie", "monster", "creature", "grave", "dead", "terror", "scream", "darkness", "horror", "鬼", "狼", "僵尸", "怪物", "恐怖"]],
  ["dance-pop", ["dance", "dancing", "dancer", "disco", "party", "club", "beat", "groove", "rhythm", "move", "floor", "rock", "walk", "talk", "step", "spotlight", "stage", "show", "跳舞", "舞台", "节奏"]],
  ["romance-pop", ["love", "lover", "heart", "kiss", "baby", "darling", "sweet", "girl", "woman", "changed", "feel", "same", "stay", "forever", "together", "touch", "hold", "rose", "爱情", "女孩", "心", "改变"]],
  ["rain-memory", ["rain", "raining", "storm", "thunder", "umbrella", "tears", "cry", "memory", "remember", "forget", "window", "puddle", "雨", "伞", "泪", "哭", "回忆", "窗"]],
  ["lonely-night", ["lonely", "alone", "empty", "silence", "miss", "goodbye", "shadow", "night", "midnight", "sleepless", "cold", "blue", "phone", "孤独", "寂寞", "夜", "午夜", "影子"]],
  ["cosmic-world", ["star", "starlight", "sky", "moon", "sun", "planet", "galaxy", "cosmic", "space", "universe", "world", "heaven", "dream", "fly", "firework", "星", "天空", "月亮", "宇宙", "世界"]],
  ["urban-stage", ["city", "street", "neon", "lights", "downtown", "subway", "train", "car", "drive", "road", "hotel", "bar", "radio", "record", "vinyl", "microphone", "crowd", "城市", "街", "霓虹", "灯", "公路", "唱片", "麦克风"]],
];

function formatClock(seconds) {
  const safe = Math.max(0, Number(seconds) || 0);
  const minutes = Math.floor(safe / 60);
  const rest = Math.floor(safe % 60);
  return `${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
}

function setStatus(node, text) {
  node.textContent = text;
  updatePixelFront();
}

const tuneModes = [
  { id: "natural", label: "LIGHT", preset: "studio" },
  { id: "standard", label: "STANDARD", preset: "studio" },
  { id: "hard", label: "HARD", preset: "tape" },
];

function activeTuneMode() {
  return tuneModes.find((mode) => mode.id === state.tuneMode) || tuneModes[1];
}

function isRecording() {
  return Boolean(state.recorder && state.recorder.state === "recording");
}

function isMixPlaying() {
  return Boolean(state.activeGraph);
}

function setPixelStep(name, status) {
  const node = pixelStepMap[name];
  if (node) node.dataset.state = status || "waiting";
}

function pixelReadyForRecording() {
  return Boolean(state.backingUrl && (visualPlanReady() || state.visualPlan));
}

function hasAutoPipelineSource() {
  return Boolean(state.songFile || songFile?.files?.[0] || pixelSongFile?.files?.[0] || state.jobId);
}

function updateStudioAutoControls() {
  if (!studioAutoButton && !studioAutoStatus) return;
  const hasSource = hasAutoPipelineSource();
  if (studioAutoButton) {
    studioAutoButton.disabled = Boolean(state.pixelWorkflowRunning) || !hasSource;
    studioAutoButton.textContent = state.pixelWorkflowRunning ? "制作中..." : "一键制作";
  }
  if (studioAutoStatus) {
    studioAutoStatus.textContent =
      state.pixelWorkflowMessage ||
      state.pixelWorkflowError ||
      (hasSource ? "点一次制作：自动分轨、查歌词、生成字幕时间轴和动画。" : "拖入原歌，填歌手和歌名，然后点一次制作。");
  }
}

function updatePixelFront() {
  if (!pixelDisc) return;
  const working = Boolean(state.pixelWorkflowRunning);
  const recording = isRecording();
  const playing = isMixPlaying();
  const ready = pixelReadyForRecording();
  const hasLyrics = hasLyricText();
  const hasAnimation = visualPlanReady() || Boolean(state.visualPlan);

  pixelDisc.classList.toggle("is-spinning", working || recording);
  pixelDisc.classList.toggle("is-ready", ready && !working && !recording);
  document.body.classList.toggle("is-pixel-ready", ready);
  document.body.classList.toggle("is-pixel-recording", recording);
  document.body.classList.toggle("is-pixel-playing", playing);

  if (pixelSongLabel) pixelSongLabel.textContent = state.songFile?.name || songName?.textContent || "把原歌拖到这里";
  if (pixelDeckMode) pixelDeckMode.textContent = activeTuneMode().label;
  if (pixelStyleButton) pixelStyleButton.textContent = `STYLE ${activeTuneMode().label}`;
  if (pixelMakeButton) {
    pixelMakeButton.disabled = Boolean(state.pixelWorkflowRunning) || !(state.songFile || pixelSongFile?.files?.[0]);
  }

  setPixelStep("project", state.jobId ? "ready" : working ? "active" : "waiting");
  setPixelStep("split", state.backingUrl ? "ready" : working && state.jobId ? "active" : "waiting");
  setPixelStep("lyrics", state.lyricCues.length ? "ready" : hasLyrics || (working && state.backingUrl) ? "active" : "waiting");
  setPixelStep("animation", hasAnimation ? "ready" : state.pixelWorkflowError ? "todo" : working && hasLyrics ? "active" : "waiting");

  if (pixelRecordButton) {
    pixelRecordButton.disabled = !recording && (!ready || !state.capabilities.recorder);
    pixelRecordButton.classList.toggle("active", recording);
  }
  if (pixelPlayButton) {
    pixelPlayButton.disabled = !playing && !(state.backingUrl && (state.recordedBlob || state.savedTakeUrl));
    pixelPlayButton.classList.toggle("active", playing);
  }
  if (pixelDeckReady) {
    if (recording) pixelDeckReady.textContent = "REC";
    else if (playing) pixelDeckReady.textContent = "PLAY";
    else if (working) pixelDeckReady.textContent = "WORKING";
    else if (ready) pixelDeckReady.textContent = "READY";
    else if (state.pixelWorkflowError) pixelDeckReady.textContent = "CHECK";
    else pixelDeckReady.textContent = "WAITING";
  }
  if (pixelFrontStatus) {
    pixelFrontStatus.textContent =
      state.pixelWorkflowMessage ||
      state.pixelWorkflowError ||
      (ready ? "准备好了。按录音键，电视会跟着伴奏跑动画。" : "拖入原歌，前台会自动建项目、分轨、字幕和动画。");
  }
  updateStudioAutoControls();
}

function mirrorPixelScreenToFront() {
  if (!pixelFrontCtx || !pixelFrontScreen) return;
  if (pixelFrontScreen.width !== pixelScreen.width || pixelFrontScreen.height !== pixelScreen.height) {
    pixelFrontScreen.width = pixelScreen.width;
    pixelFrontScreen.height = pixelScreen.height;
  }
  pixelFrontCtx.imageSmoothingEnabled = false;
  pixelFrontCtx.clearRect(0, 0, pixelFrontScreen.width, pixelFrontScreen.height);
  pixelFrontCtx.drawImage(pixelScreen, 0, 0, pixelFrontScreen.width, pixelFrontScreen.height);
}

function lyricLinesFromInput() {
  return lyricsInput.value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function hasLyricText() {
  return lyricLinesFromInput().length > 0;
}

function cueTextsMatch(lines, cues = state.lyricCues) {
  if (!Array.isArray(lines) || !Array.isArray(cues) || lines.length !== cues.length) return false;
  return lines.every((line, index) => String(cues[index]?.text || "").trim() === String(line || "").trim());
}

function lyricsSignature() {
  return `${state.currentTitle}|${lyricsInput.value.trim()}`;
}

function cueSignature(cues = state.lyricCues) {
  if (!Array.isArray(cues) || !cues.length) return "no-cues";
  return cues
    .map((cue) => {
      const start = Math.round(Number(cue.start || 0) * 10) / 10;
      const end = Math.round(Number(cue.end || 0) * 10) / 10;
      return `${start}-${end}:${String(cue.text || "").trim()}`;
    })
    .join("|");
}

function planSourceLabel(plan = state.visualPlan) {
  if (!plan) return "待生成";
  return plan.source === "codex" ? "Codex 分镜" : "本地兜底";
}

function visualPlanHasSprites(plan = state.visualPlan) {
  return Boolean(
    plan &&
      Array.isArray(plan.scenes) &&
      plan.scenes.some((scene) => {
        if (scene?.keyVisual && typeof scene.keyVisual === "object" && String(scene.keyVisual.subject || "").trim()) return true;
        const clip = scene?.clip || {};
        return Array.isArray(clip.sprites) && clip.sprites.length && Array.isArray(clip.spritePlacements) && clip.spritePlacements.length;
      }),
  );
}

function visualPlanReady() {
  return Boolean(
    hasLyricText() &&
      state.lyricCues.length &&
      state.visualPlan &&
      state.visualPlanKey &&
      visualPlanHasSprites(state.visualPlan) &&
      state.visualPlan.cueSignature === cueSignature() &&
      state.visualPlan.lyricsSignature === lyricsSignature(),
  );
}

function setPipelineStep(name, text, status = "waiting") {
  const node = pipelineStepMap[name];
  if (!node) return;
  node.textContent = text;
  node.dataset.state = status;
}

function updatePipelineStatus() {
  const hasLyrics = hasLyricText();
  const cuesReady = hasLyrics && state.lyricCues.length > 0;
  const planReady = visualPlanReady();
  const cueText = !hasLyrics ? "1 字幕时间轴：等待歌词" : cuesReady ? `1 字幕时间轴：${state.lyricCues.length} 句已生成` : "1 字幕时间轴：待生成";
  const planText = !hasLyrics
    ? "2 动画分镜：等待歌词"
    : planReady
      ? `2 动画分镜：${planSourceLabel()} / ${state.visualPlan.scenes.length} 段`
      : cuesReady
        ? "2 动画分镜：待重新生成"
        : "2 动画分镜：等待时间轴";
  const renderText = planReady
    ? state.exportSession
      ? "3 预览/导出：导出中"
      : state.visualPreview
        ? "3 预览/导出：预览中"
        : state.backingUrl && (state.recordedBlob || state.savedTakeUrl) && state.capabilities.exporter
          ? "3 预览/导出：可预览/导出"
          : "3 预览/导出：可预览，导出等录音"
    : "3 预览/导出：等待分镜";

  setPipelineStep("cues", cueText, cuesReady ? "ready" : hasLyrics ? "dirty" : "waiting");
  setPipelineStep("plan", planText, planReady ? "ready" : cuesReady ? "dirty" : "waiting");
  setPipelineStep("render", renderText, planReady ? (state.visualPreview || state.exportSession ? "active" : "ready") : "waiting");
}

function invalidateVisualPlan(message = "", options = {}) {
  const hadPlan = Boolean(state.visualPlan || state.visualPlanKey || state.contentProfile);
  state.visualPlan = null;
  state.visualPlanKey = "";
  state.contentProfile = null;
  state.contentProfileKey = "";
  state.waveformProfile = null;
  if (message && (hadPlan || options.forceStatus) && !options.silent) setStatus(contentStatus, message);
  updatePipelineStatus();
}

function setLyricCues(cues, options = {}) {
  const normalized = Array.isArray(cues)
    ? cues
        .map((cue) => ({
          text: String(cue.text || "").trim(),
          start: Math.max(0, Number(cue.start || 0)),
          end: Math.max(0, Number(cue.end || 0)),
        }))
        .filter((cue) => cue.text && Number.isFinite(cue.start) && Number.isFinite(cue.end) && cue.end > cue.start)
    : [];
  const changed = cueSignature(normalized) !== cueSignature(state.lyricCues);
  state.lyricCues = normalized;
  if (changed) {
    invalidateVisualPlan(options.message || "字幕时间轴已变化，动画分镜已失效。", { silent: options.silent });
  } else {
    updatePipelineStatus();
  }
  updateRecordControls();
  return changed;
}

function refreshVisualPlanTimingKey() {
  if (state.visualPlan) {
    state.visualPlan.cueSignature = cueSignature();
    state.visualPlan.lyricsSignature = lyricsSignature();
    state.visualPlanKey = visualPlanKey(Number(state.visualPlan.duration || estimateDuration()), state.waveformProfile);
  }
  updatePipelineStatus();
}

function shouldKeepVisualPlanOnMediaEvent() {
  return Boolean(state.loadingProject || performance.now() < (state.mediaInvalidationSuppressedUntil || 0) || visualPlanReady());
}

function shiftLyricCues(delta) {
  const amount = Number(delta) || 0;
  if (!state.lyricCues.length || Math.abs(amount) < 0.001) {
    setStatus(contentStatus, "还没有字幕时间轴；先点一键制作。");
    return;
  }
  state.lyricCues = state.lyricCues
    .map((cue) => {
      const duration = Math.max(0.35, Number(cue.end) - Number(cue.start));
      const start = Math.max(0, Number(cue.start) + amount);
      const end = Math.max(start + 0.35, Number(cue.end) + amount, start + duration);
      return {
        ...cue,
        start: Number(start.toFixed(3)),
        end: Number(end.toFixed(3)),
      };
    })
    .sort((a, b) => Number(a.start) - Number(b.start));
  refreshVisualPlanTimingKey();
  updateRecordControls();
  drawAlignmentWaveform();
  const direction = amount < 0 ? "提前" : "延后";
  setStatus(contentStatus, `字幕已整体${direction} ${Math.abs(amount).toFixed(2)}s；预览/录音/导出会按新时间轴走。`);
  scheduleProjectSave();
}

function targetSceneCount(duration = estimateDuration()) {
  const safeDuration = Math.max(1, Number(duration) || 1);
  return Math.max(1, Math.min(60, Math.round(safeDuration / 15) || 1));
}

function updateMixLabels() {
  const offset = clamp(Number(vocalOffset.value) || 0, Number(vocalOffset.min) || -30, Number(vocalOffset.max) || 30);
  vocalOffset.value = offset.toFixed(2);
  offsetOut.textContent = `${offset >= 0 ? "+" : ""}${offset.toFixed(2)}s`;
  backingGainOut.textContent = `${Math.round(Number(backingGain.value) * 100)}%`;
  vocalGainOut.textContent = `${Math.round(Number(vocalGain.value) * 100)}%`;
}

function resetAlignmentCache(options = {}) {
  if (options.reference !== false) {
    state.alignmentReferenceBuffer = null;
    state.alignmentReferenceUrl = "";
    state.alignmentReferenceLabel = "";
    state.alignmentReferenceEnvelope = null;
  }
  if (options.vocal !== false) {
    state.alignmentVocalEnvelope = null;
  }
  state.alignmentLastResult = null;
  drawAlignmentWaveform();
}

function revokeUrl(url) {
  if (url) URL.revokeObjectURL(url);
}

function clearAudio(audio) {
  audio.pause();
  audio.removeAttribute("src");
  audio.load();
}

function stemTrackItems() {
  return [
    { id: "original", label: "原歌", audio: songAudio },
    { id: "lead", label: "主唱", audio: leadAudio },
    { id: "backing", label: "含和声的伴奏", audio: backingAudio },
  ];
}

function stemHasSource(item) {
  return Boolean(item?.audio && (item.audio.currentSrc || item.audio.src));
}

function stemItemById(id) {
  return stemTrackItems().find((item) => item.id === id) || stemTrackItems()[0];
}

function availableStemItems() {
  return stemTrackItems().filter(stemHasSource);
}

function activeStemItem() {
  const requested = stemItemById(state.activeStemTrack);
  if (stemHasSource(requested)) return requested;
  const fallback = availableStemItems()[0] || requested;
  state.activeStemTrack = fallback.id;
  return fallback;
}

function stemTimelineDuration() {
  const durations = availableStemItems()
    .map((item) => Number(item.audio.duration || 0))
    .filter((duration) => Number.isFinite(duration) && duration > 0);
  return durations.length ? Math.max(...durations) : 0;
}

function downloadNameForStem(kind) {
  const base = (state.currentTitle || "Pixel OK").replace(/[\\/:*?"<>|]+/g, " ").trim() || "Pixel OK";
  return `${base} - ${kind}.wav`;
}

function setStemDownload(link, url, filename) {
  if (!link) return;
  if (url) {
    link.href = url;
    link.download = filename;
    link.classList.remove("disabled");
    link.setAttribute("aria-disabled", "false");
  } else {
    link.href = "#";
    link.removeAttribute("download");
    link.classList.add("disabled");
    link.setAttribute("aria-disabled", "true");
  }
}

function updateStemDownloads() {
  setStemDownload(downloadLeadStem, state.leadUrl, downloadNameForStem("主唱"));
  setStemDownload(downloadBackingStem, state.backingUrl, downloadNameForStem("伴奏"));
}

function pauseStemAudios(exceptAudio = null) {
  stemTrackItems().forEach((item) => {
    if (item.audio !== exceptAudio) item.audio.pause();
  });
}

function syncStemAudioTime(audio, position = state.stemPosition) {
  if (!audio || !stemHasSource({ audio })) return;
  const duration = Number(audio.duration || stemTimelineDuration() || 0);
  const safePosition = clamp(Number(position) || 0, 0, Math.max(0, duration - 0.03));
  try {
    if (Math.abs((Number(audio.currentTime) || 0) - safePosition) > 0.04) audio.currentTime = safePosition;
  } catch {
    // Some browsers reject currentTime before metadata is ready; the next metadata event will resync.
  }
}

function isStemPlaying() {
  const item = activeStemItem();
  return stemHasSource(item) && !item.audio.paused && !item.audio.ended;
}

function setStemLinkedAnimation(active) {
  if (active) {
    state.visualPreview = {
      mode: "stem",
      startedAt: performance.now(),
    };
    previewMvButton.classList.add("active");
    previewMvButton.textContent = "停止像素屏";
  } else if (state.visualPreview?.mode === "stem") {
    state.visualPreview = null;
    previewMvButton.classList.remove("active");
    previewMvButton.textContent = "预览像素屏";
  }
  updatePipelineStatus();
}

function activateStemLinkedAnimation() {
  if (visualPlanReady() || state.visualPlan) {
    setStemLinkedAnimation(true);
    return;
  }
  if (!hasLyricText()) return;
  ensureAnimationReady({ duration: stemTimelineDuration() || estimateDuration() })
    .then(() => {
      if (isStemPlaying()) setStemLinkedAnimation(true);
    })
    .catch((error) => {
      setStatus(contentStatus, error.message || "动画还没有准备好。");
    });
}

function updateStemTransport(position = null) {
  const item = activeStemItem();
  const duration = stemTimelineDuration();
  const rawPosition = position ?? (stemHasSource(item) ? item.audio.currentTime : state.stemPosition);
  const safePosition = clamp(Number(rawPosition) || 0, 0, duration || 0);
  state.stemPosition = safePosition;

  stemSeek.max = String(Math.max(0, duration));
  stemSeek.disabled = duration <= 0;
  if (!state.stemSeeking) stemSeek.value = String(safePosition);
  if (stemCurrent) stemCurrent.textContent = formatClock(safePosition);
  if (stemDurationLabel) stemDurationLabel.textContent = formatClock(duration);
  if (stemActiveLabel) stemActiveLabel.textContent = item.label;

  const activeAvailable = stemHasSource(item);
  stemPlayButton.disabled = !activeAvailable;
  stemPlayButton.textContent = isStemPlaying() ? "暂停" : "播放";
  stemPlayButton.setAttribute?.("aria-label", isStemPlaying() ? `暂停${item.label}` : `播放${item.label}`);

  stemTrackButtons.forEach((button) => {
    const buttonItem = stemItemById(button.dataset.stemTrack);
    const available = stemHasSource(buttonItem);
    button.disabled = !available;
    button.classList.toggle("active", buttonItem.id === item.id);
  });
}

function scheduleStemTick() {
  cancelAnimationFrame(state.stemRaf);
  const tick = () => {
    if (!isStemPlaying()) {
      updateStemTransport(state.stemPosition);
      return;
    }
    const item = activeStemItem();
    updateStemTransport(item.audio.currentTime);
    state.stemRaf = requestAnimationFrame(tick);
  };
  state.stemRaf = requestAnimationFrame(tick);
}

async function playActiveStem() {
  const item = activeStemItem();
  if (!stemHasSource(item)) return;
  const duration = stemTimelineDuration();
  if (duration > 0 && state.stemPosition >= duration - 0.03) state.stemPosition = 0;
  pauseStemAudios(item.audio);
  syncStemAudioTime(item.audio, state.stemPosition);
  try {
    await item.audio.play();
    activateStemLinkedAnimation();
  } catch (error) {
    setStatus(splitStatus, error.message || "浏览器暂时不能播放这个音轨。");
  }
  updateStemTransport(item.audio.currentTime);
  scheduleStemTick();
}

function pauseActiveStem() {
  const item = activeStemItem();
  if (stemHasSource(item)) state.stemPosition = Number(item.audio.currentTime) || state.stemPosition;
  pauseStemAudios();
  cancelAnimationFrame(state.stemRaf);
  setStemLinkedAnimation(false);
  updateStemTransport(state.stemPosition);
}

async function toggleStemPlayback() {
  if (isStemPlaying()) {
    pauseActiveStem();
  } else {
    await playActiveStem();
  }
}

async function switchStemTrack(trackId) {
  const next = stemItemById(trackId);
  if (!stemHasSource(next)) return;
  const previous = activeStemItem();
  const wasPlaying = isStemPlaying();
  const position = stemHasSource(previous) ? Number(previous.audio.currentTime || state.stemPosition) : state.stemPosition;
  state.activeStemTrack = next.id;
  state.stemPosition = clamp(position, 0, stemTimelineDuration() || position || 0);
  pauseStemAudios(next.audio);
  syncStemAudioTime(next.audio, state.stemPosition);
  updateStemTransport(state.stemPosition);
  if (wasPlaying) await playActiveStem();
}

async function seekStemTrack(position, keepPlaying = isStemPlaying()) {
  state.stemPosition = clamp(Number(position) || 0, 0, stemTimelineDuration() || 0);
  const item = activeStemItem();
  syncStemAudioTime(item.audio, state.stemPosition);
  if (keepPlaying) {
    await playActiveStem();
  } else {
    updateStemTransport(state.stemPosition);
  }
}

function refreshStemPlayer(options = {}) {
  if (options.resetPosition) {
    state.stemPosition = 0;
    state.activeStemTrack = "original";
    pauseStemAudios();
  }
  updateStemDownloads();
  updateStemTransport(state.stemPosition);
}

function safeFileStem(file) {
  if (!file) return "Pixel OK";
  return file.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim() || file.name;
}

function projectSnapshot() {
  const visual = {
    visualPlan: state.visualPlan || null,
    visualPlanKey: state.visualPlanKey || "",
    waveformProfile: state.waveformProfile || state.visualPlan?.waveform || null,
    savedAt: new Date().toISOString(),
  };
  return {
    job_id: state.jobId,
    title: state.currentTitle,
    currentTitle: state.currentTitle,
    lyrics: lyricsInput.value,
    lyricCues: state.lyricCues,
    lyricsMeta: state.lyricsMeta,
    lyricLookup: {
      artist: lyricArtist.value.trim(),
      title: lyricTitle.value.trim(),
    },
    screen: {
      ratio: screenRatio.value,
      lyricStyle: lyricStyle.value,
    },
    mix: {
      activePreset: state.activePreset,
      tuneMode: state.tuneMode,
      vocalOffset: vocalOffset.value,
      backingEnabled: mixBackingEnabled.checked,
      backingGain: backingGain.value,
      vocalGain: vocalGain.value,
    },
    visual,
    visualPlan: visual.visualPlan,
    visualPlanKey: visual.visualPlanKey,
    waveformProfile: visual.waveformProfile,
    take: state.savedTakeUrl ? { url: state.savedTakeUrl } : null,
  };
}

function restoreSavedVisualState(saved) {
  const visual = saved?.visual && typeof saved.visual === "object" ? saved.visual : {};
  const rawPlan = saved?.visualPlan || visual.visualPlan || visual.plan || null;
  const rawWaveform = saved?.waveformProfile || visual.waveformProfile || rawPlan?.waveform || null;

  state.visualPlan = null;
  state.visualPlanKey = "";
  state.waveformProfile = rawWaveform && typeof rawWaveform === "object" ? rawWaveform : null;
  state.contentProfile = null;
  state.contentProfileKey = "";

  if (!rawPlan || typeof rawPlan !== "object") {
    updatePipelineStatus();
    return false;
  }

  const duration = Number(rawPlan.duration || state.waveformProfile?.duration || estimateDuration());
  state.visualPlan = normalizeVisualProfile(rawPlan, Number.isFinite(duration) && duration > 0 ? duration : estimateDuration(), state.waveformProfile);
  state.visualPlanKey = visualPlanKey(Number(state.visualPlan.duration || duration || estimateDuration()), state.waveformProfile);
  updatePipelineStatus();
  return visualPlanReady();
}

function scheduleProjectSave() {
  if (state.loadingProject || !state.jobId) return;
  clearTimeout(state.saveTimer);
  state.saveTimer = setTimeout(() => saveProjectNow(), 550);
}

async function saveProjectNow() {
  if (state.loadingProject || !state.jobId) return;
  try {
    const response = await fetch(`/api/projects/${state.jobId}/state`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(projectSnapshot()),
    });
    if (!response.ok) throw new Error("保存失败");
    setStatus(projectStatus, `项目已保存：${state.currentTitle}`);
    refreshProjects(false);
  } catch (error) {
    setStatus(projectStatus, error.message || "项目保存失败");
  }
}

async function uploadTakeToProject() {
  if (!state.jobId || !state.recordedBlob) return;
  const formData = new FormData();
  formData.append("take", state.recordedBlob, `pixel-ok-${state.jobId}-take.webm`);
  const response = await fetch(`/api/projects/${state.jobId}/take`, { method: "POST", body: formData });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || "录音保存失败");
  state.savedTakeUrl = payload.url;
  downloadTake.href = state.savedTakeUrl;
  recordedAudio.src = state.savedTakeUrl;
  setStatus(projectStatus, "录音已保存进当前项目。");
}

async function createProjectFromFile(file) {
  const generation = state.projectGeneration;
  const formData = new FormData();
  formData.append("original", file);
  setStatus(projectStatus, "正在创建新项目并保存原歌。");
  state.projectCreatePromise = fetch("/api/projects", { method: "POST", body: formData })
    .then(async (response) => {
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "创建项目失败");
      if (generation !== state.projectGeneration) return payload;
      state.jobId = payload.job_id;
      state.currentTitle = payload.state?.currentTitle || state.currentTitle;
      if (payload.downloads?.original) songAudio.src = payload.downloads.original;
      setStatus(projectStatus, `新项目已创建：${state.currentTitle}`);
      refreshProjects(false);
      scheduleProjectSave();
      return payload;
    })
    .catch((error) => {
      setStatus(projectStatus, error.message || "创建项目失败，分轨时会重试保存。");
      throw error;
    })
    .finally(() => {
      if (generation === state.projectGeneration) state.projectCreatePromise = null;
    });
  return state.projectCreatePromise;
}

function projectTimeLabel(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getMonth() + 1}/${date.getDate()} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function renderProjects(projects) {
  projectList.innerHTML = "";
  if (projectVaultSummary) {
    const active = projects.find((project) => project.job_id === state.jobId);
    projectVaultSummary.textContent = active
      ? `当前：${active.title || active.original_name || active.job_id}`
      : projects.length
        ? `${projects.length} 个保存项目`
        : "无历史项目";
  }
  if (projectVaultDetails && !projects.length && !state.jobId) projectVaultDetails.open = false;
  if (!projects.length) {
    const empty = document.createElement("p");
    empty.className = "status";
    empty.textContent = "还没有历史项目。新歌会自动保存到这里。";
    projectList.appendChild(empty);
    return;
  }
  projects.forEach((project) => {
    const row = document.createElement("div");
    row.className = `project-item${project.job_id === state.jobId ? " active" : ""}`;
    const title = document.createElement("div");
    title.className = "project-title";
    title.innerHTML = `<strong></strong><span></span>`;
    title.querySelector("strong").textContent = project.title || project.original_name || project.job_id;
    const tags = [
      project.has_stems ? "已分轨" : "未分轨",
      project.has_visual_plan ? "有动画" : "无动画",
      project.lyric_count ? `${project.lyric_count}句歌词` : "无歌词",
      project.has_take ? "有录音" : "无录音",
      projectTimeLabel(project.updated_at),
    ].filter(Boolean);
    title.querySelector("span").textContent = tags.join(" / ");

    const loadButton = document.createElement("button");
    loadButton.type = "button";
    loadButton.textContent = "载入";
    loadButton.addEventListener("click", () => loadProject(project.job_id));

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "project-delete";
    deleteButton.textContent = "删除";
    deleteButton.addEventListener("click", () => deleteProject(project.job_id, project.title || project.job_id));

    row.append(title, loadButton, deleteButton);
    projectList.appendChild(row);
  });
}

async function refreshProjects(showStatus = true) {
  try {
    const response = await fetch("/api/projects");
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "读取项目列表失败");
    renderProjects(payload.projects || []);
    if (showStatus) setStatus(projectStatus, "项目列表已刷新。");
  } catch (error) {
    setStatus(projectStatus, error.message || "读取项目列表失败");
  }
}

function setPresetButton(presetName) {
  state.activePreset = presets[presetName] ? presetName : "studio";
  presetGrid.querySelectorAll("button").forEach((item) => {
    item.classList.toggle("active", item.dataset.preset === state.activePreset);
  });
  updatePixelFront();
}

async function loadProject(jobId) {
  stopMixPreview();
  state.projectGeneration += 1;
  clearTimeout(state.separationPollTimer);
  state.projectCreatePromise = null;
  state.loadingProject = true;
  state.mediaInvalidationSuppressedUntil = performance.now() + 6000;
  setStatus(projectStatus, "正在载入项目。");
  try {
    const response = await fetch(`/api/projects/${jobId}`);
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "载入项目失败");
    const saved = payload.state || {};
    const downloads = payload.downloads || {};

    revokeUrl(state.songObjectUrl);
    revokeUrl(state.recordedUrl);
    state.songFile = null;
    songFile.value = "";
    state.songObjectUrl = "";
    state.recordedBlob = null;
    state.recordedUrl = "";
    state.mixPosition = 0;
    state.vocalBuffer = null;
    state.vocalBufferKey = "";
    state.jobId = jobId;
    state.backingUrl = downloads.backing_with_harmony || downloads.accompaniment || "";
    state.acapellaUrl = downloads.acapella || "";
    state.leadUrl = downloads.lead_vocal || "";
    state.harmonyUrl = downloads.backing_vocals || "";
    state.savedTakeUrl = downloads.take || saved.take?.url || "";
    state.currentTitle = saved.currentTitle || saved.title || payload.project?.title || "Pixel OK";
    state.lyricCues = Array.isArray(saved.lyricCues) ? saved.lyricCues : [];
    state.lyricsMeta = saved.lyricsMeta || null;
    state.visualPlan = null;
    state.visualPlanKey = "";
    state.waveformProfile = null;
    state.contentProfile = null;
    state.contentProfileKey = "";
    state.backingBuffer = null;
    state.backingBufferUrl = "";
    state.vocalBuffer = null;
    state.vocalBufferKey = "";
    resetAlignmentCache();
    updateMixTransport(0);

    songName.textContent = payload.project?.original_name || state.currentTitle;
    if (downloads.original) songAudio.src = downloads.original; else clearAudio(songAudio);
    if (state.backingUrl) backingAudio.src = state.backingUrl; else clearAudio(backingAudio);
    if (state.acapellaUrl) acapellaAudio.src = state.acapellaUrl; else clearAudio(acapellaAudio);
    acapellaWrap?.classList.add("hidden");
    if (state.leadUrl) {
      leadAudio.src = state.leadUrl;
      leadWrap.classList.remove("hidden");
    } else {
      clearAudio(leadAudio);
      leadWrap.classList.add("hidden");
    }
    if (state.harmonyUrl) {
      harmonyAudio.src = state.harmonyUrl;
      harmonyWrap.classList.remove("hidden");
    } else {
      clearAudio(harmonyAudio);
      harmonyWrap.classList.add("hidden");
    }
    stemTracks.classList.toggle("hidden", !downloads.original);
    refreshStemPlayer({ resetPosition: true });
    drawWaveform(null, songWave);

    lyricsInput.value = saved.lyrics || "";
    const savedLookup = saved.lyricLookup || {};
    const savedMatch = state.lyricsMeta?.match || {};
    lyricArtist.value = savedLookup.artist || savedMatch.artist_name || "";
    lyricTitle.value = savedLookup.title || savedMatch.track_name || state.currentTitle || "";
    if (pixelArtistInput) pixelArtistInput.value = lyricArtist.value;
    if (pixelTitleInput) pixelTitleInput.value = lyricTitle.value;
    restoreSavedVisualState(saved);
    if (saved.screen) {
      screenRatio.value = saved.screen.ratio || screenRatio.value;
      lyricStyle.value = saved.screen.lyricStyle || lyricStyle.value || "karaoke";
      applyScreenRatio();
    }
    if (saved.mix) {
      vocalOffset.value = saved.mix.vocalOffset ?? vocalOffset.value;
      backingGain.value = saved.mix.backingGain ?? backingGain.value;
      vocalGain.value = saved.mix.vocalGain ?? vocalGain.value;
      mixBackingEnabled.checked = saved.mix.backingEnabled ?? mixBackingEnabled.checked;
      state.tuneMode = saved.mix.tuneMode || state.tuneMode || "standard";
      setPresetButton(saved.mix.activePreset || "studio");
      updateMixLabels();
    }

    if (state.savedTakeUrl) {
      recordedAudio.src = state.savedTakeUrl;
      downloadTake.href = state.savedTakeUrl;
      downloadTake.classList.remove("hidden");
      playMixButton.disabled = !state.backingUrl;
      exportMvButton.disabled = !state.backingUrl || !state.capabilities.exporter;
    } else {
      clearAudio(recordedAudio);
      downloadTake.classList.add("hidden");
      playMixButton.disabled = true;
      exportMvButton.disabled = true;
    }

    splitButton.disabled = !downloads.original || !state.capabilities.uvr;
    harmonyButton.disabled = true;
    autoLyricsButton.disabled = !state.leadUrl || !state.capabilities.asr;
    updateRecordControls();
    redoRecordButton.disabled = !state.savedTakeUrl;

    const separation = payload.project?.separation || {};
    if (separation.status === "running") {
      splitButton.disabled = true;
      setStatus(splitStatus, separation.message || "后台正在分轨。");
      pollSeparation(jobId, state.projectGeneration);
    } else if (separation.status === "error") {
      setStatus(splitStatus, `上次分轨失败：${separation.message || "未知错误"}`);
    } else {
      setStatus(splitStatus, state.backingUrl && state.leadUrl ? "已载入三轨：原轨、主唱、含和声的伴奏。" : "已载入项目；一键制作会自动补齐三轨。");
    }
    setStatus(contentStatus, state.visualPlan ? `已载入视觉分镜：${state.visualPlan.themeLabel || "Codex"}` : "已恢复歌词/动画状态。");
    setStatus(mvStatus, `已载入项目：${state.currentTitle}`);
    setStatus(projectStatus, `当前项目：${state.currentTitle}`);
    updatePipelineStatus();
    refreshProjects(false);
  } catch (error) {
    setStatus(projectStatus, error.message || "载入项目失败");
  } finally {
    state.loadingProject = false;
    state.mediaInvalidationSuppressedUntil = Math.max(state.mediaInvalidationSuppressedUntil || 0, performance.now() + 2500);
  }
}

async function deleteProject(jobId, title) {
  if (!confirm(`删除项目「${title}」？这个操作会删除保存的音频和进度。`)) return;
  try {
    const response = await fetch(`/api/projects/${jobId}`, { method: "DELETE" });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "删除项目失败");
    if (state.jobId === jobId) {
      state.projectGeneration += 1;
      clearTimeout(state.separationPollTimer);
      state.songFile = null;
      revokeUrl(state.songObjectUrl);
      revokeUrl(state.recordedUrl);
      state.songObjectUrl = "";
      state.jobId = "";
      state.backingUrl = "";
      state.acapellaUrl = "";
      state.leadUrl = "";
      state.harmonyUrl = "";
      state.recordedBlob = null;
      state.recordedUrl = "";
      state.savedTakeUrl = "";
      state.mixPosition = 0;
      state.backingBuffer = null;
      state.backingBufferUrl = "";
      state.acapellaBuffer = null;
      state.acapellaBufferUrl = "";
      state.acapellaSegments = null;
      state.acapellaSegmentsUrl = "";
      state.vocalBuffer = null;
      state.vocalBufferKey = "";
      state.currentTitle = "Pixel OK";
      songFile.value = "";
      songName.textContent = "Drop a song to start";
      clearAudio(songAudio);
      clearAudio(backingAudio);
      clearAudio(acapellaAudio);
      clearAudio(leadAudio);
      clearAudio(harmonyAudio);
      clearAudio(recordedAudio);
      stemTracks.classList.add("hidden");
      refreshStemPlayer({ resetPosition: true });
      acapellaWrap?.classList.add("hidden");
      leadWrap.classList.add("hidden");
      harmonyWrap.classList.add("hidden");
      downloadTake.classList.add("hidden");
      splitButton.disabled = true;
      harmonyButton.disabled = true;
      autoLyricsButton.disabled = true;
      updateRecordControls();
      redoRecordButton.disabled = true;
      playMixButton.disabled = true;
      exportMvButton.disabled = true;
      lyricsInput.value = "";
      lyricArtist.value = "";
      lyricTitle.value = "";
      state.lyricCues = [];
      state.visualPlan = null;
      state.visualPlanKey = "";
      state.waveformProfile = null;
      state.contentProfile = null;
      state.contentProfileKey = "";
      updateMixTransport(0);
      drawWaveform(null, songWave);
      setStatus(projectStatus, "当前项目已删除。拖入原歌可开始新项目。");
      updatePipelineStatus();
    }
    refreshProjects(false);
  } catch (error) {
    setStatus(projectStatus, error.message || "删除项目失败");
  }
}

async function drawWaveform(file, canvas) {
  const wctx = canvas.getContext("2d");
  wctx.clearRect(0, 0, canvas.width, canvas.height);
  wctx.fillStyle = "#0c1017";
  wctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!file) return;

  try {
    const buffer = await file.arrayBuffer();
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const decoded = await audioCtx.decodeAudioData(buffer.slice(0));
    const data = decoded.getChannelData(0);
    const step = Math.max(1, Math.floor(data.length / canvas.width));
    const mid = canvas.height / 2;
    wctx.strokeStyle = "#45f5a1";
    wctx.lineWidth = 2;
    wctx.beginPath();
    for (let x = 0; x < canvas.width; x += 1) {
      let min = 0;
      let max = 0;
      const start = x * step;
      for (let i = 0; i < step && start + i < data.length; i += 1) {
        const v = data[start + i];
        if (v < min) min = v;
        if (v > max) max = v;
      }
      wctx.moveTo(x, mid + min * mid * 0.86);
      wctx.lineTo(x, mid + max * mid * 0.86);
    }
    wctx.stroke();
    await audioCtx.close();
  } catch {
    wctx.fillStyle = "#9aa7bc";
    wctx.font = "700 15px Segoe UI, sans-serif";
    wctx.fillText("这个格式不能在浏览器里预览波形，但仍可上传处理。", 16, 64);
  }
}

function wireDropzone() {
  const zone = songFile.closest(".dropzone");
  songFile.addEventListener("change", () => {
    const file = songFile.files[0];
    if (file) loadSongFile(file);
  });

  ["dragenter", "dragover"].forEach((type) => {
    zone.addEventListener(type, (event) => {
      event.preventDefault();
      zone.classList.add("drag-over");
    });
  });
  ["dragleave", "drop"].forEach((type) => {
    zone.addEventListener(type, () => zone.classList.remove("drag-over"));
  });
  zone.addEventListener("drop", (event) => {
    event.preventDefault();
    const file = event.dataTransfer?.files?.[0];
    if (!file) return;
    const transfer = new DataTransfer();
    transfer.items.add(file);
    songFile.files = transfer.files;
    loadSongFile(file);
  });
}

function loadSongFile(file) {
  clearTimeout(state.separationPollTimer);
  state.songFile = file;
  state.projectGeneration += 1;
  state.projectCreatePromise = null;
  state.jobId = "";
  state.backingUrl = "";
  state.acapellaUrl = "";
  state.leadUrl = "";
  state.harmonyUrl = "";
  state.savedTakeUrl = "";
  state.recordedBlob = null;
  state.mixPosition = 0;
  state.vocalBuffer = null;
  state.vocalBufferKey = "";
  state.backingBuffer = null;
  state.backingBufferUrl = "";
  resetAlignmentCache();
  state.acapellaBuffer = null;
  state.acapellaBufferUrl = "";
  state.acapellaSegments = null;
  state.acapellaSegmentsUrl = "";
  state.visualPlan = null;
  state.visualPlanKey = "";
  state.waveformProfile = null;
  state.contentProfile = null;
  state.contentProfileKey = "";
  state.lyricCues = [];
  state.lyricsMeta = null;
  lyricsInput.value = "";
  state.currentTitle = safeFileStem(file);
  lyricTitle.value = state.currentTitle;
  lyricArtist.value = "";

  revokeUrl(state.songObjectUrl);
  revokeUrl(state.recordedUrl);
  state.songObjectUrl = URL.createObjectURL(file);
  state.recordedUrl = "";
  songAudio.src = state.songObjectUrl;
  songName.textContent = file.name;
  stemTracks.classList.remove("hidden");
  clearAudio(backingAudio);
  clearAudio(acapellaAudio);
  clearAudio(leadAudio);
  clearAudio(harmonyAudio);
  clearAudio(recordedAudio);
  refreshStemPlayer({ resetPosition: true });
  downloadTake.classList.add("hidden");
  acapellaWrap?.classList.add("hidden");
  leadWrap.classList.add("hidden");
  harmonyWrap.classList.add("hidden");
  splitButton.disabled = !state.capabilities.uvr;
  harmonyButton.disabled = true;
  autoLyricsButton.disabled = true;
  updateRecordControls();
  redoRecordButton.disabled = true;
  playMixButton.disabled = true;
  exportMvButton.disabled = true;
  drawWaveform(file, songWave);
  updateMixTransport(0);
  buildLyricCues();
  setStatus(splitStatus, state.capabilities.uvr ? "一键制作会用 UVR 自动生成三轨：原轨、主唱、含和声的伴奏。" : "三轨分离需要 UVR 就绪。");
  setStatus(mvStatus, `识别到歌曲：${state.currentTitle}`);
  updatePipelineStatus();
  createProjectFromFile(file).catch(() => {});
}

async function loadCapabilities() {
  try {
    const response = await fetch("/api/capabilities");
    const caps = await response.json();
    state.capabilities = {
      ...caps,
      recorder: Boolean(navigator.mediaDevices && window.MediaRecorder),
      exporter: Boolean(pixelScreen.captureStream && window.MediaRecorder),
    };
  } catch {
    state.capabilities = {
      recorder: Boolean(navigator.mediaDevices && window.MediaRecorder),
      exporter: Boolean(pixelScreen.captureStream && window.MediaRecorder),
    };
  }

  document.querySelectorAll("#capabilities span").forEach((item) => {
    const ready = Boolean(state.capabilities[item.dataset.cap]);
    item.classList.toggle("ready", ready);
    item.textContent = item.textContent.replace(" ready", "") + (ready ? " ready" : "");
  });
  if (state.songFile || state.jobId) splitButton.disabled = !state.capabilities.uvr;
  harmonyButton.disabled = true;
  autoLyricsButton.disabled = !state.leadUrl || !state.capabilities.asr;
  updateRecordControls();
  playMixButton.disabled = !(state.backingUrl && (state.recordedBlob || state.savedTakeUrl));
  exportMvButton.disabled = !(state.backingUrl && (state.recordedBlob || state.savedTakeUrl) && state.capabilities.exporter);
  refreshStemPlayer();
  updatePipelineStatus();
  updatePixelFront();
}

function applySeparationDownloads(payload) {
  const downloads = payload?.downloads || payload?.result?.downloads || {};
  if (!downloads || !Object.keys(downloads).length) return;
  const previousReferenceUrl = alignmentReferenceUrl().url;

  if (payload.job_id) state.jobId = payload.job_id;
  state.backingUrl = downloads.backing_with_harmony || downloads.accompaniment || state.backingUrl;
  state.acapellaUrl = downloads.acapella || state.acapellaUrl || "";
  state.leadUrl = downloads.lead_vocal || state.leadUrl || "";
  state.harmonyUrl = downloads.backing_vocals || state.harmonyUrl || "";

  if (downloads.original) songAudio.src = downloads.original;
  if (state.backingUrl) backingAudio.src = state.backingUrl;
  if (state.acapellaUrl) acapellaAudio.src = state.acapellaUrl;
  if (state.leadUrl) {
    leadAudio.src = state.leadUrl;
    leadWrap.classList.remove("hidden");
  }
  if (state.harmonyUrl) {
    harmonyAudio.src = state.harmonyUrl;
  }
  acapellaWrap?.classList.add("hidden");
  harmonyWrap.classList.add("hidden");
  stemTracks.classList.remove("hidden");
  if (alignmentReferenceUrl().url !== previousReferenceUrl) {
    resetAlignmentCache({ vocal: false });
    updateMixTransport(state.mixPosition);
  }
  refreshStemPlayer();
}

function finishSeparation(payload) {
  applySeparationDownloads(payload);
  harmonyButton.disabled = true;
  autoLyricsButton.disabled = !state.leadUrl || !state.capabilities.asr;
  updateRecordControls();
  splitButton.disabled = (!state.songFile && !state.jobId) || !state.capabilities.uvr;
  setStatus(splitStatus, payload.message || "三轨完成。现在只看原轨、主唱、含和声的伴奏。");
  setStatus(recordStatus, state.capabilities.recorder ? "可以开始跟含和声的伴奏录音。" : "浏览器没有可用的录音能力。");
  setStatus(contentStatus, state.capabilities.asr ? "一键制作会自动查歌词、生成字幕时间轴和动画。" : "未检测到本地歌词识别模型；一键制作会优先用歌手歌名查歌词。");
  invalidateVisualPlan("音轨/波形已更新，动画分镜已失效。", { silent: !state.visualPlan });
  buildLyricCues();
  scheduleProjectSave();
  refreshProjects(false);
}

async function pollSeparation(jobId, generation = state.projectGeneration) {
  clearTimeout(state.separationPollTimer);
  if (!jobId || generation !== state.projectGeneration) return;
  try {
    const response = await fetch(`/api/separate-status/${jobId}`);
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "读取分轨状态失败");
    if (generation !== state.projectGeneration || state.jobId !== jobId) return;
    applySeparationDownloads(payload);
    if (payload.status === "complete") {
      finishSeparation(payload);
      return;
    }
    if (payload.status === "error") {
      setStatus(splitStatus, payload.message || "分轨失败");
      splitButton.disabled = (!state.songFile && !state.jobId) || !state.capabilities.uvr;
      return;
    }
    setStatus(splitStatus, payload.message || "后台正在分轨。");
    splitButton.disabled = true;
    state.separationPollTimer = setTimeout(() => pollSeparation(jobId, generation), 2500);
  } catch (error) {
    if (generation !== state.projectGeneration) return;
    setStatus(splitStatus, error.message || "分轨状态读取失败");
    state.separationPollTimer = setTimeout(() => pollSeparation(jobId, generation), 4000);
  }
}

async function splitSong() {
  if ((!state.songFile && !state.jobId) || splitButton.disabled) return;
  if (state.projectCreatePromise) {
    try {
      await state.projectCreatePromise;
    } catch {
      // If project creation failed, separating can still upload the selected file.
    }
  }
  const formData = new FormData();
  if (state.jobId) {
    formData.append("job_id", state.jobId);
  } else if (state.songFile) {
    formData.append("original", state.songFile);
  }

  splitButton.disabled = true;
  harmonyButton.disabled = true;
  recordButton.disabled = true;
  if (skipIntroRecordButton) skipIntroRecordButton.disabled = true;
  setStatus(splitStatus, "正在启动后台三轨分离任务。");

  try {
    const response = await fetch("/api/separate", { method: "POST", body: formData });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "分轨失败");

    state.jobId = payload.job_id || state.jobId;
    applySeparationDownloads(payload);
    if (payload.status === "complete" || payload.result) {
      finishSeparation(payload);
    } else {
      setStatus(splitStatus, payload.message || "后台正在分轨。");
      await pollSeparation(state.jobId, state.projectGeneration);
    }
  } catch (error) {
    setStatus(splitStatus, error.message || "分轨失败");
    splitButton.disabled = (!state.songFile && !state.jobId) || !state.capabilities.uvr;
  }
}

function applyAsrLyrics(payload) {
  const segments = Array.isArray(payload.segments) ? payload.segments : [];
  const cleanSegments = segments
    .map((segment) => ({
      text: String(segment.text || "").trim(),
      start: Number(segment.start || 0),
      end: Number(segment.end || 0),
    }))
    .filter((segment) => segment.text && Number.isFinite(segment.start) && Number.isFinite(segment.end) && segment.end > segment.start);

  const text = String(payload.text || cleanSegments.map((segment) => segment.text).join("\n")).trim();
  lyricsInput.value = text;
  state.lyricsMeta = {
    source: payload.lyrics_source || "heart_transcriptor",
    engine: payload.engine || "本地歌词模型",
    match: payload.lyrics_match || null,
    sourceFile: payload.source || "",
    updatedAt: new Date().toISOString(),
  };
  setLyricCues(cleanSegments, { message: "识别结果已更新时间轴，动画分镜已失效。", silent: true });
  invalidateVisualPlan("识别结果已更新，动画分镜已失效。", { silent: true });
  scheduleProjectSave();
}

async function searchOfficialLyrics(options = {}) {
  const title = lyricTitle.value.trim() || state.currentTitle;
  const artist = lyricArtist.value.trim();
  if (!title) {
    setStatus(contentStatus, "先填歌名，一键制作才能查到官方歌词。");
    if (options.throwOnError) throw new Error("先填歌名，一键制作才能查到官方歌词。");
    return false;
  }
  if (state.projectCreatePromise) {
    try {
      await state.projectCreatePromise;
    } catch {
      // Searching can still run without a saved project; it just cannot use server-side audio timing.
    }
  }

  searchLyricsButton.disabled = true;
  autoLyricsButton.disabled = true;
  scanLyricsButton.disabled = true;
  visualPlanButton.disabled = true;
  setStatus(contentStatus, "正在按歌手/歌名查歌词库，并按当前音频重新估计时间轴。");
  try {
    const response = await fetch("/api/lyrics/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        job_id: state.jobId,
        artist,
        title,
        duration: estimateDuration(),
      }),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "歌词搜索失败");
    applyAsrLyrics(payload);
    const match = payload.lyrics_match || {};
    const matchedArtist = match.artist_name || artist;
    const matchedTitle = match.track_name || title;
    lyricArtist.value = matchedArtist;
    lyricTitle.value = matchedTitle;
    state.currentTitle = [matchedArtist, matchedTitle].filter(Boolean).join(" - ") || matchedTitle || state.currentTitle;
    const timing = match.timing || {};
    const timingText = timing.strategy ? `时间策略：${timing.strategy}${Number.isFinite(timing.base_shift_seconds) ? ` ${timing.base_shift_seconds}s` : ""}。` : "";
    setStatus(contentStatus, `已匹配 ${state.currentTitle}，生成 ${state.lyricCues.length || 0} 行歌词时间轴。${timingText}一键流程会继续生成动画。`);
    setStatus(mvStatus, `已更新 ${state.lyricCues.length || 0} 行卡拉 OK 歌词时间轴。`);
    scheduleProjectSave();
    return true;
  } catch (error) {
    setStatus(contentStatus, error.message || "歌词搜索失败");
    if (options.throwOnError) throw error;
    return false;
  } finally {
    searchLyricsButton.disabled = false;
    autoLyricsButton.disabled = !state.leadUrl || !state.capabilities.asr;
    scanLyricsButton.disabled = false;
    visualPlanButton.disabled = false;
    updatePipelineStatus();
  }
}

async function autoRecognizeLyrics() {
  if (!state.jobId || autoLyricsButton.disabled) return;
  autoLyricsButton.disabled = true;
  scanLyricsButton.disabled = true;
  visualPlanButton.disabled = true;
  const lookup = readLookupFields(null, "studio");
  if (lookup.canSearchOfficial) {
    setStatus(contentStatus, "已填写歌手/歌名，先查官方歌词；不会用本地识别结果冒充歌词。");
    try {
      await searchOfficialLyrics({ throwOnError: true });
      const plan = await requestVisualPlan(estimateDuration(), { force: true });
      const planNote = plan
        ? `${planSourceLabel(plan)}已生成：${plan.themeLabel}，${plan.scenes.length} 段。`
        : "动画分镜等待歌词/时间轴。";
      setStatus(contentStatus, `已用官方歌词更新字幕时间轴。${planNote}`);
      setStatus(mvStatus, `已生成 ${state.lyricCues.length || 0} 行卡拉 OK 歌词时间轴。`);
    } catch (error) {
      setStatus(contentStatus, `官方歌词失败：${error.message || "未知错误"}。已停止，不会写入本地识别错词。`);
    } finally {
      autoLyricsButton.disabled = !state.leadUrl || !state.capabilities.asr;
      scanLyricsButton.disabled = false;
      visualPlanButton.disabled = false;
      updatePipelineStatus();
    }
    return;
  }

  setStatus(contentStatus, "没有填写歌名，正在用本地 HeartTranscriptor 尝试识别歌词。GPU 可用时会自动走 GPU。");
  try {
    const response = await fetch("/api/transcribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ job_id: state.jobId, source: "lead" }),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "歌词识别失败");
    applyAsrLyrics(payload);
    const duration = Number(payload.duration || estimateDuration());
    if (!state.lyricCues.length) {
      await buildLyricCues();
    }
    const plan = await requestVisualPlan(duration);
    const planNote = plan
      ? `${planSourceLabel(plan)}已生成：${plan.themeLabel}，${plan.scenes.length} 段；${plan.waveform ? "波形已接入" : "等待波形"}。`
      : "动画分镜等待歌词/时间轴。";
    if (payload.lyrics_source === "lrclib") {
      const match = payload.lyrics_match || {};
      const matchName = [match.track_name, match.artist_name].filter(Boolean).join(" - ");
      setStatus(contentStatus, `已用 HeartTranscriptor 判断歌曲，并用 LRCLIB 歌词替换${matchName ? `：${matchName}` : ""}。${planNote}`);
    } else {
      setStatus(contentStatus, `已保留 ${payload.engine || "本地歌词模型"} 的识别结果，歌词库没有足够可信的匹配。${planNote}`);
    }
    setStatus(mvStatus, `已生成 ${state.lyricCues.length || 0} 行卡拉 OK 歌词时间轴，并生成动画分镜。`);
  } catch (error) {
    setStatus(contentStatus, error.message || "歌词识别失败");
  } finally {
    autoLyricsButton.disabled = !state.leadUrl || !state.capabilities.asr;
    scanLyricsButton.disabled = false;
    visualPlanButton.disabled = false;
    updatePipelineStatus();
  }
}

async function splitHarmony() {
  if (!state.jobId || !state.capabilities.uvr) return;
  harmonyButton.disabled = true;
  setStatus(splitStatus, "UVR 正在试拆主唱和和声/剩余人声。");
  try {
    const response = await fetch("/api/separate-vocal-layers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ job_id: state.jobId }),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "和声拆分失败");
    state.leadUrl = payload.downloads.lead_vocal;
    state.backingUrl = payload.downloads.backing_with_harmony || state.backingUrl;
    state.harmonyUrl = payload.downloads.backing_vocals;
    leadAudio.src = state.leadUrl;
    backingAudio.src = state.backingUrl;
    harmonyAudio.src = state.harmonyUrl;
    leadWrap.classList.remove("hidden");
    harmonyWrap.classList.add("hidden");
    invalidateVisualPlan("主唱/伴奏波形已更新，动画分镜已失效。", { silent: !state.visualPlan });
    buildLyricCues();
    scheduleProjectSave();
    refreshProjects(false);
    setStatus(splitStatus, `UVR 拆分完成，用时 ${payload.processing_seconds || 0}s。结果需要试听判断。`);
  } catch (error) {
    setStatus(splitStatus, error.message || "和声拆分失败");
  } finally {
    harmonyButton.disabled = !state.jobId || !state.capabilities.uvr;
  }
}

async function getAcapellaBuffer() {
  const sourceUrl = state.leadUrl || state.acapellaUrl;
  if (!sourceUrl) return null;
  if (!state.acapellaBuffer || state.acapellaBufferUrl !== sourceUrl) {
    state.acapellaBuffer = await decodeUrl(sourceUrl);
    state.acapellaBufferUrl = sourceUrl;
  }
  return state.acapellaBuffer;
}

function percentile(values, pct) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.max(0, Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * pct)));
  return sorted[index];
}

function detectVocalSegments(buffer) {
  if (!buffer || !buffer.length || !buffer.sampleRate) return [];
  const sampleRate = buffer.sampleRate;
  const frameSize = Math.max(1024, Math.floor(sampleRate * 0.08));
  const frameSeconds = frameSize / sampleRate;
  const channels = Array.from(
    { length: Math.min(2, buffer.numberOfChannels || 1) },
    (_, index) => buffer.getChannelData(index),
  );
  const frames = [];

  for (let start = 0; start < buffer.length; start += frameSize) {
    const end = Math.min(buffer.length, start + frameSize);
    let sum = 0;
    let count = 0;
    for (let i = start; i < end; i += 1) {
      let mixed = 0;
      channels.forEach((channel) => {
        mixed += channel[i] || 0;
      });
      mixed /= channels.length || 1;
      sum += mixed * mixed;
      count += 1;
    }
    frames.push({
      start: start / sampleRate,
      end: end / sampleRate,
      rms: count ? Math.sqrt(sum / count) : 0,
    });
  }

  const levels = frames.map((frame) => frame.rms);
  const quiet = percentile(levels, 0.35);
  const loud = percentile(levels, 0.9);
  const threshold = Math.max(quiet + (loud - quiet) * 0.28, loud * 0.16, 0.0025);
  if (!Number.isFinite(threshold) || loud < 0.001) return [];

  const segments = [];
  let current = null;
  let lastActiveEnd = 0;
  const maxGap = 0.7;

  frames.forEach((frame) => {
    if (frame.rms >= threshold) {
      if (!current) {
        current = { start: Math.max(0, frame.start - frameSeconds * 0.5), end: frame.end, peak: frame.rms };
      } else {
        current.end = frame.end;
        current.peak = Math.max(current.peak, frame.rms);
      }
      lastActiveEnd = frame.end;
      return;
    }

    if (current && frame.start - lastActiveEnd > maxGap) {
      current.end = lastActiveEnd;
      segments.push(current);
      current = null;
    }
  });

  if (current) {
    current.end = lastActiveEnd || current.end;
    segments.push(current);
  }

  const duration = buffer.duration || buffer.length / sampleRate;
  const merged = [];
  segments
    .filter((segment) => segment.end - segment.start >= 0.35)
    .forEach((segment) => {
      const next = {
        start: Math.max(0, segment.start),
        end: Math.min(duration, segment.end + 0.16),
        peak: segment.peak,
      };
      const last = merged[merged.length - 1];
      if (last && next.start - last.end <= maxGap) {
        last.end = Math.max(last.end, next.end);
        last.peak = Math.max(last.peak, next.peak);
      } else {
        merged.push(next);
      }
    });
  return merged;
}

function cachedVocalSegments(buffer) {
  if (!buffer) return [];
  if (!state.acapellaSegments || state.acapellaSegmentsUrl !== state.acapellaBufferUrl) {
    state.acapellaSegments = detectVocalSegments(buffer);
    state.acapellaSegmentsUrl = state.acapellaBufferUrl;
  }
  return state.acapellaSegments;
}

function cuesFromSegments(lines, segments, duration) {
  const usable = segments.filter((segment) => segment.end > segment.start);
  if (!lines.length || !usable.length) return null;

  const activeDuration = usable.reduce((total, segment) => total + segment.end - segment.start, 0);
  if (activeDuration < Math.min(lines.length * 0.28, 3)) return null;

  const timeAtActiveOffset = (target) => {
    let consumed = 0;
    for (const segment of usable) {
      const length = segment.end - segment.start;
      if (target <= consumed + length) {
        return segment.start + Math.max(0, target - consumed);
      }
      consumed += length;
    }
    return usable[usable.length - 1].end;
  };

  const cues = lines.map((text, index) => {
    const startTarget = (activeDuration * index) / lines.length;
    const endTarget = (activeDuration * (index + 1)) / lines.length;
    const start = Math.max(0, timeAtActiveOffset(startTarget) - 0.12);
    const rawEnd = Math.min(duration, timeAtActiveOffset(endTarget) + 0.28);
    return { text, start, end: Math.max(rawEnd, Math.min(duration, start + 0.75)) };
  });

  for (let index = 0; index < cues.length - 1; index += 1) {
    cues[index].end = Math.min(cues[index].end, Math.max(cues[index].start + 0.35, cues[index + 1].start));
  }
  return cues;
}

async function buildLyricCues(options = {}) {
  const refreshPlan = Boolean(options.refreshPlan);
  const sourceLyrics = lyricsInput.value;
  const lines = lyricLinesFromInput();
  const duration = Number(leadAudio.duration || acapellaAudio.duration || backingAudio.duration || songAudio.duration || 0);
  if (!lines.length) {
    setLyricCues([], { message: "歌词已清空，动画分镜已失效。", silent: options.silent });
    scheduleProjectSave();
    return;
  }
  if (!options.force && state.lyricsMeta?.source === "lrclib" && cueTextsMatch(lines)) {
    updatePipelineStatus();
    return;
  }

  const fallbackDuration = Math.max(lines.length * 4, 12);
  const total = Number.isFinite(duration) && duration > 1 ? duration : fallbackDuration;

  try {
    const acapellaBuffer = await getAcapellaBuffer();
    const segments = cachedVocalSegments(acapellaBuffer);
    const matched = cuesFromSegments(lines, segments, Math.max(total, acapellaBuffer?.duration || 0));
    if (lyricsInput.value !== sourceLyrics) return;
    if (matched) {
      setLyricCues(matched, { message: "字幕时间轴已变化，动画分镜已失效。", silent: options.silent });
      setStatus(mvStatus, `已根据阿卡贝拉人声段落粗配 ${lines.length} 句歌词。`);
      if (refreshPlan) await requestVisualPlan(Math.max(total, acapellaBuffer?.duration || 0));
      scheduleProjectSave();
      return;
    }
  } catch {
    // Browser audio unlock rules can block background decoding; the time-based fallback still works.
  }

  const leadIn = Math.min(2.0, total * 0.08);
  const usable = Math.max(total - leadIn - 0.8, lines.length);
  if (lyricsInput.value !== sourceLyrics) return;
  setLyricCues(lines.map((text, index) => {
    const start = leadIn + (index / lines.length) * usable;
    const end = leadIn + ((index + 1) / lines.length) * usable;
    return { text, start, end };
  }), { message: "字幕时间轴已变化，动画分镜已失效。", silent: options.silent });
  setStatus(mvStatus, `已按阿卡贝拉/歌曲时长粗配 ${lines.length} 句歌词。`);
  if (refreshPlan) await requestVisualPlan(total);
  scheduleProjectSave();
}

function cueAt(time) {
  if (!state.lyricCues.length) return null;
  if (time < state.lyricCues[0].start) return null;
  return state.lyricCues.find((cue) => time >= cue.start && time < cue.end) || state.lyricCues[state.lyricCues.length - 1];
}

function nextCue(time) {
  return state.lyricCues.find((cue) => cue.start > time) || null;
}

function visualTime() {
  if (state.exportSession) {
    return Math.max(0, (performance.now() - state.exportSession.startedAt) / 1000);
  }
  if (state.activeGraph) {
    return Math.max(0, state.activeGraph.seekPosition + state.audioCtx.currentTime - state.activeGraph.baseTime);
  }
  if (isStemPlaying()) {
    const item = activeStemItem();
    return Math.max(0, Number(item.audio.currentTime || state.stemPosition || 0));
  }
  if (state.visualPreview) {
    return ((performance.now() - state.visualPreview.startedAt) / 1000) * Number(scanSpeed.value);
  }
  if (!backingAudio.paused && Number.isFinite(backingAudio.currentTime)) {
    return backingAudio.currentTime;
  }
  return 0;
}

function applyScreenRatio() {
  const [w, h] = screenRatio.value.split(":").map(Number);
  const height = 720;
  pixelScreen.height = height;
  pixelScreen.width = Math.round((height * w) / h);
  pixelScreen.style.aspectRatio = `${w} / ${h}`;
}

function pixelText(text, x, y, size, color, align = "center") {
  ctx2d.font = `900 ${size}px Consolas, "Microsoft YaHei", monospace`;
  ctx2d.textAlign = align;
  ctx2d.textBaseline = "middle";
  ctx2d.fillStyle = "rgba(255, 93, 157, 0.78)";
  ctx2d.fillText(text, x + 4, y);
  ctx2d.fillStyle = "rgba(79, 216, 255, 0.72)";
  ctx2d.fillText(text, x - 3, y);
  ctx2d.fillStyle = color;
  ctx2d.fillText(text, x, y);
}

function pixelTextClean(text, x, y, size, color, align = "center") {
  ctx2d.font = `900 ${size}px Consolas, "Microsoft YaHei", monospace`;
  ctx2d.textAlign = align;
  ctx2d.textBaseline = "middle";
  ctx2d.fillStyle = "rgba(0, 0, 0, 0.72)";
  ctx2d.fillText(text, x + 2, y + 2);
  ctx2d.fillStyle = color;
  ctx2d.fillText(text, x, y);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function hashText(text) {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seeded(seed, index = 0) {
  const value = Math.sin(seed * 12.9898 + index * 78.233) * 43758.5453;
  return value - Math.floor(value);
}

function rect(x, y, width, height, color, alpha = 1) {
  const oldAlpha = ctx2d.globalAlpha;
  ctx2d.globalAlpha = clamp(Number(alpha) || 0, 0, 1);
  ctx2d.fillStyle = color;
  ctx2d.fillRect(Math.round(x), Math.round(y), Math.round(width), Math.round(height));
  ctx2d.globalAlpha = oldAlpha;
}

function strokeRect(x, y, width, height, color, alpha = 1, lineWidth = 2) {
  const oldAlpha = ctx2d.globalAlpha;
  ctx2d.globalAlpha = clamp(Number(alpha) || 0, 0, 1);
  ctx2d.strokeStyle = color;
  ctx2d.lineWidth = lineWidth;
  ctx2d.strokeRect(Math.round(x), Math.round(y), Math.round(width), Math.round(height));
  ctx2d.globalAlpha = oldAlpha;
}

function paletteFor(seed) {
  const palettes = [
    ["#45f5a1", "#4fd8ff", "#ff5d9d", "#ffd166"],
    ["#4fd8ff", "#ff5d9d", "#fff2a8", "#45f5a1"],
    ["#ffd166", "#45f5a1", "#4fd8ff", "#ff4f4f"],
    ["#ff5d9d", "#ffd166", "#45f5a1", "#b6a3ff"],
    ["#f4f7fb", "#4fd8ff", "#45f5a1", "#ff5d9d"],
  ];
  return palettes[seed % palettes.length];
}

function estimateDuration() {
  const mediaDuration = Number(backingAudio.duration || leadAudio.duration || acapellaAudio.duration || songAudio.duration || 0);
  if (Number.isFinite(mediaDuration) && mediaDuration > 1) return mediaDuration;
  const lineCount = lyricsInput.value.split(/\r?\n/).filter((line) => line.trim()).length;
  return Math.max(lineCount * 4, 12);
}

function energyBinsForBuffer(buffer, binCount = 48) {
  if (!buffer || !buffer.length || !buffer.sampleRate) return [];
  const channels = Array.from(
    { length: Math.min(2, buffer.numberOfChannels || 1) },
    (_, index) => buffer.getChannelData(index),
  );
  const raw = [];

  for (let bin = 0; bin < binCount; bin += 1) {
    const start = Math.floor((buffer.length * bin) / binCount);
    const end = Math.max(start + 1, Math.floor((buffer.length * (bin + 1)) / binCount));
    const step = Math.max(1, Math.floor((end - start) / 900));
    let sum = 0;
    let count = 0;
    for (let sampleIndex = start; sampleIndex < end; sampleIndex += step) {
      let mixed = 0;
      channels.forEach((channel) => {
        mixed += channel[sampleIndex] || 0;
      });
      mixed /= channels.length || 1;
      sum += mixed * mixed;
      count += 1;
    }
    raw.push(count ? Math.sqrt(sum / count) : 0);
  }

  const nonZero = raw.filter((value) => value > 0);
  const peak = Math.max(percentile(nonZero, 0.96), Math.max(...raw) * 0.72, 0.000001);
  return raw.map((value) => Number(clamp(value / peak, 0, 1).toFixed(3)));
}

function waveformPeaks(bins, duration) {
  if (!bins.length) return [];
  const candidates = bins
    .map((value, index) => ({
      index,
      value,
      time: ((index + 0.5) / bins.length) * duration,
    }))
    .filter((item, index) => {
      const before = bins[Math.max(0, index - 1)] || 0;
      const after = bins[Math.min(bins.length - 1, index + 1)] || 0;
      return item.value >= 0.22 && item.value >= before && item.value >= after;
    })
    .sort((a, b) => b.value - a.value);

  const selected = [];
  candidates.forEach((item) => {
    if (selected.length >= 8) return;
    if (selected.every((picked) => Math.abs(picked.index - item.index) > 2)) selected.push(item);
  });
  return selected
    .sort((a, b) => a.time - b.time)
    .map((item) => ({ time: Number(item.time.toFixed(2)), value: Number(item.value.toFixed(3)) }));
}

function curveFromBins(bins, duration, maxPoints = 160) {
  if (!bins.length || !Number.isFinite(duration) || duration <= 0) return [];
  const step = Math.max(1, Math.ceil(bins.length / maxPoints));
  const curve = [];
  for (let index = 0; index < bins.length; index += step) {
    curve.push({
      time: Number((((index + 0.5) / bins.length) * duration).toFixed(2)),
      value: Number(clamp(Number(bins[index]) || 0, 0, 1).toFixed(3)),
    });
  }
  return curve;
}

function positiveOnsetBins(bins) {
  if (!bins.length) return [];
  const raw = bins.map((value, index) => {
    const previous = index > 0 ? Number(bins[index - 1]) || 0 : Number(value) || 0;
    return Math.max(0, (Number(value) || 0) - previous);
  });
  const peak = Math.max(...raw, 0.000001);
  return raw.map((value) => Number(clamp(value / peak, 0, 1).toFixed(3)));
}

function estimateBpmFromBins(bins, duration) {
  if (bins.length < 24 || !Number.isFinite(duration) || duration <= 0) return 120;
  const sampleRate = bins.length / duration;
  const onsets = positiveOnsetBins(bins);
  let best = { bpm: 120, score: -Infinity };
  for (let bpm = 70; bpm <= 180; bpm += 1) {
    const lag = Math.round((sampleRate * 60) / bpm);
    if (lag < 2 || lag >= bins.length / 2) continue;
    let score = 0;
    let count = 0;
    for (let index = lag; index < bins.length; index += 1) {
      score += onsets[index] * onsets[index - lag] + (Number(bins[index]) || 0) * (Number(bins[index - lag]) || 0) * 0.12;
      count += 1;
    }
    const normalized = count ? score / count : 0;
    if (normalized > best.score) best = { bpm, score: normalized };
  }
  return best.bpm;
}

function buildBeatGrid(bins, duration, bpm) {
  if (!bins.length || !Number.isFinite(duration) || duration <= 0) return [];
  const interval = 60 / clamp(Number(bpm) || 120, 70, 180);
  const sampleRate = bins.length / duration;
  const onsets = positiveOnsetBins(bins);
  let anchorIndex = 0;
  let anchorScore = -Infinity;
  const searchEnd = Math.max(1, Math.min(bins.length, Math.round(sampleRate * Math.min(duration, 24))));
  for (let index = 0; index < searchEnd; index += 1) {
    const score = onsets[index] * 0.75 + (Number(bins[index]) || 0) * 0.25;
    if (score > anchorScore) {
      anchorScore = score;
      anchorIndex = index;
    }
  }

  const snapBeat = (time) => {
    const center = Math.round(time * sampleRate);
    const radius = Math.max(1, Math.round(sampleRate * Math.min(0.16, interval * 0.22)));
    let bestIndex = clamp(center, 0, bins.length - 1);
    let bestScore = -Infinity;
    for (let index = Math.max(0, center - radius); index <= Math.min(bins.length - 1, center + radius); index += 1) {
      const distance = Math.abs(index - center) / Math.max(1, radius);
      const score = onsets[index] * 0.8 + (Number(bins[index]) || 0) * 0.28 - distance * 0.18;
      if (score > bestScore) {
        bestScore = score;
        bestIndex = index;
      }
    }
    return bestIndex / sampleRate;
  };

  const anchor = anchorIndex / sampleRate;
  const beats = [];
  let time = anchor;
  while (time - interval >= 0) time -= interval;
  for (; time <= duration + 0.001 && beats.length < 900; time += interval) {
    const snapped = snapBeat(time);
    if (snapped >= 0 && snapped <= duration && (!beats.length || snapped - beats[beats.length - 1] > interval * 0.42)) {
      beats.push(Number(snapped.toFixed(3)));
    }
  }
  return beats;
}

function buildSectionsFromAnalysis(bins, duration, barTimes = []) {
  if (!Number.isFinite(duration) || duration <= 0) return [];
  const targetCount = Math.max(2, Math.min(24, Math.round(duration / 18)));
  const average = bins.length ? bins.reduce((total, value) => total + (Number(value) || 0), 0) / bins.length : 0.5;
  const sections = [];
  const nearestBar = (time) => {
    if (!barTimes.length) return time;
    let best = time;
    let distance = Infinity;
    barTimes.forEach((barTime) => {
      const nextDistance = Math.abs(barTime - time);
      if (nextDistance < distance && nextDistance < 5) {
        best = barTime;
        distance = nextDistance;
      }
    });
    return best;
  };

  for (let index = 0; index < targetCount; index += 1) {
    const rawStart = (duration * index) / targetCount;
    const rawEnd = index === targetCount - 1 ? duration : (duration * (index + 1)) / targetCount;
    const start = index === 0 ? 0 : nearestBar(rawStart);
    const end = index === targetCount - 1 ? duration : Math.max(start + 4, nearestBar(rawEnd));
    const binStart = Math.floor((start / duration) * bins.length);
    const binEnd = Math.max(binStart + 1, Math.ceil((end / duration) * bins.length));
    const slice = bins.slice(binStart, binEnd);
    const intensity = slice.length ? slice.reduce((total, value) => total + (Number(value) || 0), 0) / slice.length : average;
    const label =
      index === 0 && start < 12
        ? "intro"
        : index === targetCount - 1
          ? "outro"
          : intensity > average + 0.12
            ? "chorus"
            : intensity < average - 0.12
              ? "break"
              : index % 4 === 2
                ? "bridge"
                : "verse";
    if (!sections.length || start > sections[sections.length - 1].start + 0.5) {
      sections.push({
        start: Number(clamp(start, 0, duration).toFixed(2)),
        end: Number(clamp(end, 0, duration).toFixed(2)),
        label,
        intensity: Number(clamp(intensity, 0, 1).toFixed(3)),
      });
    }
  }

  sections.forEach((section, index) => {
    if (index > 0) section.start = Math.max(section.start, sections[index - 1].end);
    if (section.end <= section.start) section.end = Math.min(duration, section.start + duration / targetCount);
  });
  if (sections.length) {
    sections[0].start = 0;
    sections[sections.length - 1].end = Number(duration.toFixed(2));
  }
  return sections.filter((section) => section.end > section.start);
}

function buildRhythmAnalysis(bins, duration) {
  if (!bins.length || !Number.isFinite(duration) || duration <= 0) return null;
  const bpm = estimateBpmFromBins(bins, duration);
  const beatTimes = buildBeatGrid(bins, duration, bpm);
  const barTimes = beatTimes.filter((_, index) => index % 4 === 0).map((time) => Number(time.toFixed(3)));
  const onsets = positiveOnsetBins(bins);
  const analysis = {
    bpm,
    beatTimes,
    barTimes,
    energyCurve: curveFromBins(bins, duration, 180),
    onsetCurve: curveFromBins(onsets, duration, 180),
  };
  analysis.sections = buildSectionsFromAnalysis(bins, duration, barTimes);
  return analysis;
}

async function buildWaveformProfile(duration = estimateDuration()) {
  const binCount = 48;
  const rhythmBinCount = Math.max(128, Math.min(2400, Math.round((Number(duration) || 180) * 8)));
  const sources = [];

  const addSource = async (name, loader) => {
    try {
      const buffer = await loader();
      const bins = energyBinsForBuffer(buffer, binCount);
      const rhythmBins = energyBinsForBuffer(buffer, rhythmBinCount);
      if (bins.length) sources.push({ name, bins, rhythmBins: rhythmBins.length ? rhythmBins : bins });
    } catch {
      // Audio decoding may be blocked until the user interacts with the page; the visual plan can still fall back to lyrics.
    }
  };

  await addSource("backing_with_harmony", async () => {
    if (!state.backingUrl) return null;
    if (!state.backingBuffer || state.backingBufferUrl !== state.backingUrl) {
      state.backingBuffer = await decodeUrl(state.backingUrl);
      state.backingBufferUrl = state.backingUrl;
    }
    return state.backingBuffer;
  });

  await addSource("lead_vocal", () => getAcapellaBuffer());

  if (!sources.length) {
    const originalUrl = songAudio.currentSrc || state.songObjectUrl;
    await addSource("original", () => (originalUrl ? decodeUrl(originalUrl) : null));
  }

  if (!sources.length) return null;

  const bins = Array.from({ length: binCount }, (_, index) => {
    const value = sources.reduce((max, source) => Math.max(max, source.bins[index] || 0), 0);
    return Number(value.toFixed(3));
  });
  const rhythmBins = Array.from({ length: rhythmBinCount }, (_, index) => {
    const value = sources.reduce((max, source) => Math.max(max, source.rhythmBins?.[index] || 0), 0);
    return Number(value.toFixed(3));
  });
  const averageEnergy = bins.reduce((total, value) => total + value, 0) / bins.length;
  const analysis = buildRhythmAnalysis(rhythmBins, duration);
  const profile = {
    duration: Number(duration.toFixed(2)),
    binCount,
    source: sources.map((source) => source.name).join("+"),
    bins,
    peaks: waveformPeaks(bins, duration),
    averageEnergy: Number(averageEnergy.toFixed(3)),
    sources: sources.slice(0, 3).map((source) => ({ name: source.name, bins: source.bins })),
    analysis,
  };
  if (analysis) {
    profile.bpm = analysis.bpm;
    profile.beatTimes = analysis.beatTimes;
    profile.barTimes = analysis.barTimes;
    profile.sections = analysis.sections;
    profile.energyCurve = analysis.energyCurve;
    profile.onsetCurve = analysis.onsetCurve;
  }
  profile.signature = `${profile.source}|${profile.bpm || 0}|${bins.map((value) => Math.round(value * 9)).join("")}|${profile.peaks
    .map((peak) => Math.round(peak.time))
    .join(",")}|b${profile.beatTimes?.length || 0}|s${profile.sections?.length || 0}`;
  return profile;
}

function extractVisualTokens(limit = 14) {
  const text = `${state.currentTitle}\n${lyricsInput.value}`;
  const stopWords = new Set(["the", "and", "you", "your", "that", "this", "with", "for", "from", "have", "just", "are", "was", "were", "啊", "呀", "啦", "的", "了", "我", "你", "他", "她"]);
  const tokens = [];
  const seen = new Set();
  for (const match of text.matchAll(/[A-Za-z][A-Za-z']{2,}|[\u4e00-\u9fff]{1,4}/g)) {
    const token = match[0].replace(/^'+|'+$/g, "").trim();
    const key = token.toLowerCase();
    if (!token || stopWords.has(key) || seen.has(key)) continue;
    seen.add(key);
    tokens.push(token.slice(0, 18));
    if (tokens.length >= limit) break;
  }
  return tokens.length ? tokens : ["stage", "singer", "microphone", "city-light"];
}

function normalizeThemeFamilyName(themeFamily) {
  const raw = String(themeFamily || "").trim().toLowerCase();
  if (abstractThemeFamilies.has(raw)) return "song-stage";
  if (semanticThemeFamilies.has(raw)) return raw;
  if (raw.includes("horror")) return "horror-pop";
  if (raw.includes("love") || raw.includes("romance")) return "romance-pop";
  if (raw.includes("dance")) return "dance-pop";
  if (raw.includes("rain") || raw.includes("memory")) return "rain-memory";
  if (raw.includes("lonely") || raw.includes("night")) return "lonely-night";
  if (raw.includes("cosmic") || raw.includes("space")) return "cosmic-world";
  if (raw.includes("urban") || raw.includes("city") || raw.includes("stage")) return "urban-stage";
  return "song-stage";
}

function detectThemeFamily(text = `${state.currentTitle}\n${lyricsInput.value}`) {
  const lower = String(text || "").toLowerCase();
  let bestTheme = "song-stage";
  let bestScore = 0;
  themeKeywordSets.forEach(([theme, keywords]) => {
    const score = keywords.reduce((total, word) => total + (word && lower.includes(word) ? 1 : 0), 0);
    if (score > bestScore) {
      bestTheme = theme;
      bestScore = score;
    }
  });
  return bestTheme;
}

function waveformHintForScene(waveform, index, count) {
  const bins = Array.isArray(waveform?.bins) ? waveform.bins : [];
  if (!bins.length) return 0.45 + (index % 3) * 0.12;
  const position = Math.round(((index + 0.5) / Math.max(1, count)) * (bins.length - 1));
  return clamp(Number(bins[position]) || 0, 0, 1);
}

function proceduralVisualBlock(seed, index, energy) {
  return {
    seed: (seed + index * 2654435761) >>> 0,
    layout: proceduralLayouts[Math.floor(seeded(seed + 11, index) * proceduralLayouts.length) % proceduralLayouts.length],
    turbulence: Number((0.28 + energy * 0.72).toFixed(3)),
    symmetry: Number((0.15 + seeded(seed + 19, index) * 0.7).toFixed(3)),
    scale: Number((0.78 + energy * 0.62).toFixed(3)),
    colorShift: Number(seeded(seed + 29, index).toFixed(3)),
    beatLock: "waveform-peaks",
  };
}

const keyVisualCompositions = new Set(["poster", "stage-card", "room-card", "street-card", "object-card", "portrait-card", "world-card"]);

function isHexColor(value) {
  return /^#([0-9a-f]{6})$/i.test(String(value || "").trim());
}

function hexLuma(color) {
  const raw = String(color || "").replace("#", "");
  if (!/^[0-9a-f]{6}$/i.test(raw)) return 0.5;
  const red = parseInt(raw.slice(0, 2), 16) / 255;
  const green = parseInt(raw.slice(2, 4), 16) / 255;
  const blue = parseInt(raw.slice(4, 6), 16) / 255;
  return red * 0.2126 + green * 0.7152 + blue * 0.0722;
}

function ensureVibrantPalette(colors) {
  const merged = [];
  [...(Array.isArray(colors) ? colors : []), ...paletteFor(hashText(state.currentTitle || "Pixel OK"))].forEach((color) => {
    const safe = String(color || "").trim().toLowerCase();
    if (!isHexColor(safe) || merged.includes(safe) || hexLuma(safe) < 0.18) return;
    merged.push(safe);
  });
  return merged.slice(0, 6).length >= 4 ? merged.slice(0, 6) : paletteFor(hashText("pixel-ok-v3"));
}

function normalizePaletteRoles(rawRoles, palette) {
  const safe = ensureVibrantPalette(palette);
  const fallback = {
    background: "#111a3f",
    key: safe[0],
    accent: safe[1] || safe[0],
    flash: "#fff6b0",
    floor: safe[2] || safe[0],
    lyric: "#f4f7fb",
  };
  const raw = rawRoles && typeof rawRoles === "object" ? rawRoles : {};
  return Object.fromEntries(
    Object.entries(fallback).map(([key, fallbackColor]) => {
      const value = String(raw[key] || fallbackColor).trim().toLowerCase();
      return [key, isHexColor(value) ? value : fallbackColor];
    }),
  );
}

function normalizeBrightness(rawBrightness) {
  const raw = rawBrightness && typeof rawBrightness === "object" ? rawBrightness : {};
  return {
    base: clamp(Number(raw.base ?? 0.68), 0.25, 1),
    backgroundLift: clamp(Number(raw.backgroundLift ?? raw.background_lift ?? 0.32), 0, 0.8),
    chorusBoost: clamp(Number(raw.chorusBoost ?? raw.chorus_boost ?? 0.36), 0, 0.9),
    flash: clamp(Number(raw.flash ?? 0.72), 0, 1),
  };
}

function normalizeComposition(rawComposition, fallback = "poster") {
  const text = String(rawComposition || fallback || "poster").trim().toLowerCase();
  return keyVisualCompositions.has(text) ? text : keyVisualCompositions.has(fallback) ? fallback : "poster";
}

function fallbackKeyVisual(themeFamily, motifs = [], index = 0) {
  const family = normalizeThemeFamilyName(themeFamily);
  const subject = clipTextToken(motifs[index % Math.max(1, motifs.length)] || state.currentTitle || "song subject", "song subject");
  const defaults = {
    "horror-pop": ["moonlit poster frame", ["moon", "eyes", "door", "shadow"]],
    "romance-pop": ["warm room poster frame", ["heart", "phone", "flower", "lamp"]],
    "dance-pop": ["bright stage card", ["microphone", "floor light", "spotlight", "speaker"]],
    "cosmic-world": ["neon world card", ["planet", "star", "horizon", "signal"]],
    "rain-memory": ["rain window card", ["window", "rain", "reflection", "umbrella"]],
    "lonely-night": ["midnight room card", ["window", "shadow", "moon", "phone"]],
    "urban-stage": ["neon street card", ["street light", "speaker", "roofline", "road"]],
    "song-stage": ["song poster card", ["microphone", "light", "symbol", "floor"]],
  };
  const [setting, symbols] = defaults[family] || defaults["song-stage"];
  return {
    subject,
    setting,
    symbols,
    foreground: `large readable pixel image of ${subject}`,
    midground: symbols.slice(0, 2).join(", "),
    background: setting,
    styleNotes: "static pixel key visual with bright beat-reactive lighting; no waveform or readable artwork text",
  };
}

function normalizeKeyVisual(rawKeyVisual, fallbackKeyVisualValue) {
  const raw = rawKeyVisual && typeof rawKeyVisual === "object" ? rawKeyVisual : {};
  const fallback = fallbackKeyVisualValue && typeof fallbackKeyVisualValue === "object" ? fallbackKeyVisualValue : fallbackKeyVisual("song-stage");
  const symbols = Array.isArray(raw.symbols || raw.props)
    ? (raw.symbols || raw.props).map((item) => String(item || "").trim()).filter(Boolean).slice(0, 6)
    : Array.isArray(fallback.symbols)
      ? fallback.symbols.slice(0, 6)
      : ["signature prop"];
  return {
    subject: clipTextToken(raw.subject || fallback.subject, "song subject"),
    setting: String(raw.setting || fallback.setting || "song-specific frame").slice(0, 120),
    symbols,
    foreground: String(raw.foreground || fallback.foreground || "large foreground subject").slice(0, 140),
    midground: String(raw.midground || fallback.midground || "supporting props").slice(0, 140),
    background: String(raw.background || fallback.background || "bright stylized setting").slice(0, 140),
    styleNotes: String(raw.styleNotes || raw.style_notes || fallback.styleNotes || "pixel key visual").slice(0, 220),
  };
}

function normalizeLighting(rawLighting, fallbackLighting, palette) {
  const raw = rawLighting && typeof rawLighting === "object" ? rawLighting : {};
  const fallback = fallbackLighting && typeof fallbackLighting === "object" ? fallbackLighting : {};
  const roles = normalizePaletteRoles(fallback.colors, palette);
  const rawColors = raw.colors && typeof raw.colors === "object" ? raw.colors : {};
  const colors = {};
  ["key", "accent", "flash", "floor"].forEach((key) => {
    const value = String(rawColors[key] || roles[key] || roles.accent || "#ffffff").trim().toLowerCase();
    colors[key] = isHexColor(value) ? value : roles[key] || "#ffffff";
  });
  return {
    base: String(raw.base || fallback.base || "bright pixel key light").slice(0, 120),
    beat: String(raw.beat || fallback.beat || "small glow pulse").slice(0, 120),
    bar: String(raw.bar || fallback.bar || "camera push and floor lift").slice(0, 120),
    peak: String(raw.peak || fallback.peak || "brief flash").slice(0, 120),
    quiet: String(raw.quiet || fallback.quiet || "held dim frame").slice(0, 120),
    chorus: String(raw.chorus || fallback.chorus || "brighter color lift").slice(0, 120),
    colors,
    intensity: clamp(Number(raw.intensity ?? fallback.intensity ?? 0.72), 0.2, 1.4),
  };
}

function normalizeSceneTimeline(scenes, fallbackScenes, duration) {
  const fallback = Array.isArray(fallbackScenes) && fallbackScenes.length ? fallbackScenes : [];
  const safeDuration = Math.max(1, Number(duration) || 1);
  let sorted = (Array.isArray(scenes) ? scenes : [])
    .filter((scene) => scene && Number.isFinite(Number(scene.start)) && Number.isFinite(Number(scene.end)) && Number(scene.end) > Number(scene.start))
    .map((scene) => ({ ...scene, start: clamp(Number(scene.start), 0, safeDuration), end: clamp(Number(scene.end), 0, safeDuration) }))
    .filter((scene) => scene.end > scene.start + 0.2)
    .sort((a, b) => a.start - b.start);
  if (!sorted.length) sorted = fallback.map((scene) => ({ ...scene }));

  const normalized = [];
  let cursor = 0;
  const addFallback = (start, end, index) => {
    const source = fallback[index % Math.max(1, fallback.length)] || sorted[index % Math.max(1, sorted.length)];
    if (!source || end - start < 0.35) return;
    normalized.push({ ...source, start, end });
  };

  sorted.forEach((scene, index) => {
    let start = clamp(scene.start, 0, safeDuration);
    let end = clamp(scene.end, 0, safeDuration);
    if (start - cursor > 0.5) addFallback(cursor, start, index);
    if (start < cursor) start = cursor;
    if (end <= start + 0.35) end = Math.min(safeDuration, start + 0.8);
    if (end > start) {
      normalized.push({ ...scene, start, end });
      cursor = end;
    }
  });

  if (!normalized.length) {
    const count = targetSceneCount(safeDuration);
    return Array.from({ length: count }, (_, index) => {
      const start = (safeDuration * index) / count;
      const end = index === count - 1 ? safeDuration : (safeDuration * (index + 1)) / count;
      const source = fallback[index % Math.max(1, fallback.length)] || {};
      return { ...source, start, end };
    });
  }
  normalized.sort((a, b) => a.start - b.start);
  if (normalized[0].start < 0.5) normalized[0].start = 0;
  else {
    const firstStart = normalized[0].start;
    const source = fallback[0] || normalized[0];
    normalized.unshift({ ...source, start: 0, end: firstStart });
  }
  const last = normalized[normalized.length - 1];
  if (safeDuration - last.end > 0.5) addFallback(last.end, safeDuration, normalized.length);
  else last.end = safeDuration;
  return normalized.sort((a, b) => a.start - b.start);
}

function clipTextToken(value, fallback = "") {
  return String(value ?? fallback).trim().slice(0, 28);
}

function clipNumber(value, fallback, min = 0, max = 1) {
  const number = Number(value);
  return Number.isFinite(number) ? clamp(number, min, max) : fallback;
}

function clipColor(value, fallback = "primary") {
  const raw = String(value || "").trim().toLowerCase();
  if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(raw)) return raw;
  if (/^palette[:.-]?\d+$/.test(raw) || /^palette\d+$/.test(raw)) return raw;
  if (["primary", "secondary", "accent", "highlight", "shadow", "skin", "hair", "warm", "light", "dark", "black", "white", "red", "blue", "yellow", "green"].includes(raw)) return raw;
  return fallback;
}

function sanitizeClipMotion(rawMotion, fallback = "pulse") {
  if (typeof rawMotion === "string") return rawMotion.slice(0, 64);
  if (!rawMotion || typeof rawMotion !== "object") return fallback;
  const mode = clipTextToken(rawMotion.mode ?? rawMotion.kind ?? rawMotion.type, fallback);
  const axis = String(rawMotion.axis || "both").toLowerCase();
  const amount = clipNumber(rawMotion.amount, 0.04, 0, 0.5);
  const axisX = axis === "x" || axis === "both" ? amount : 0;
  const axisY = axis === "y" || axis === "both" ? amount : 0;
  const axisScale = axis === "scale" || axis === "both" ? amount : 0.05;
  const axisAlpha = axis === "alpha" || mode.includes("flash") ? amount : 0.18;
  return {
    mode,
    x: clipNumber(rawMotion.x ?? rawMotion.dx, axisX, -0.25, 0.25),
    y: clipNumber(rawMotion.y ?? rawMotion.dy, axisY, -0.25, 0.25),
    scale: clipNumber(rawMotion.scale, axisScale, 0, 0.6),
    alpha: clipNumber(rawMotion.alpha, axisAlpha, 0, 0.8),
    brightness: clipNumber(rawMotion.brightness, mode.includes("flash") || mode.includes("glow") ? amount : 0.18, 0, 0.9),
    speed: clipNumber(rawMotion.speed, 1, 0.1, 8),
    beat: clipNumber(rawMotion.beat, 1, 0, 3),
    energy: clipNumber(rawMotion.energy, 1, 0, 3),
    phase: clipNumber(rawMotion.phase, 0, 0, 1),
  };
}

function sanitizeClipPart(rawPart, fallbackPart, index) {
  const raw = rawPart && typeof rawPart === "object" ? rawPart : {};
  const fallback = fallbackPart && typeof fallbackPart === "object" ? fallbackPart : {};
  const type = String(raw.type || fallback.type || "rect").toLowerCase();
  if (!["rect", "line", "poly"].includes(type)) return null;
  const part = {
    id: clipTextToken(raw.id || fallback.id || `part-${index}`, `part-${index}`).toLowerCase().replace(/[^a-z0-9_-]+/g, "-") || `part-${index}`,
    type,
    color: clipColor(raw.color || raw.fill || raw.stroke || fallback.color, fallback.color || "primary"),
    alpha: clipNumber(raw.alpha ?? fallback.alpha, 0.64, 0, 1),
    motion: sanitizeClipMotion(raw.motion ?? fallback.motion, fallback.motion || "pulse"),
  };
  if (type === "rect") {
    part.x = clipNumber(raw.x ?? fallback.x, 0.35, -0.2, 1.2);
    part.y = clipNumber(raw.y ?? fallback.y, 0.35, -0.2, 1.2);
    part.w = clipNumber(raw.w ?? raw.width ?? fallback.w, 0.3, 0.002, 1.4);
    part.h = clipNumber(raw.h ?? raw.height ?? fallback.h, 0.16, 0.002, 1.4);
  } else if (type === "line") {
    part.x1 = clipNumber(raw.x1 ?? fallback.x1, 0.2, -0.2, 1.2);
    part.y1 = clipNumber(raw.y1 ?? fallback.y1, 0.5, -0.2, 1.2);
    part.x2 = clipNumber(raw.x2 ?? fallback.x2, 0.8, -0.2, 1.2);
    part.y2 = clipNumber(raw.y2 ?? fallback.y2, 0.5, -0.2, 1.2);
    part.width = clipNumber(raw.width ?? raw.lineWidth ?? fallback.width, 0.008, 0.001, 0.08);
  } else if (type === "poly") {
    const rawPoints = Array.isArray(raw.points) ? raw.points : fallback.points;
    const points = Array.isArray(rawPoints)
      ? rawPoints
          .slice(0, 16)
          .map((point) => (Array.isArray(point) ? [clipNumber(point[0], 0.5, -0.2, 1.2), clipNumber(point[1], 0.5, -0.2, 1.2)] : null))
          .filter(Boolean)
      : [];
    part.points = points.length >= 3 ? points : [[0.48, 0.3], [0.58, 0.5], [0.48, 0.7], [0.38, 0.5]];
  }
  return part;
}

function fallbackPixelSprite(seed, token = "subject") {
  const lower = String(token || "").toLowerCase();
  if (lower.includes("camera") || lower.includes("photo") || lower.includes("scene")) {
    return {
      id: "main-sprite",
      name: "camera object",
      colors: { X: "shadow", H: "highlight", C: "secondary", A: "white" },
      rows: [
        "................",
        "....XXXXXXXX....",
        "...XHHHHHHHHX...",
        "..XHHHCCCCHHHX..",
        "..XHHCAAAACHHX..",
        "..XHHCAAAACHHX..",
        "..XHHHCCCCHHHX..",
        "...XHHHHHHHHX...",
        "....XXXXXXXX....",
        "................",
      ],
    };
  }
  if (lower.includes("love") || lower.includes("heart") || lower.includes("girl")) {
    return {
      id: "main-sprite",
      name: "heart object",
      colors: { R: "accent", H: "highlight" },
      rows: [
        "................",
        "....RR....RR....",
        "...RRRR..RRRR...",
        "..RRRRRRRRRRRR..",
        "..RRRRRRRRRRRR..",
        "...RRRRHHRRRR...",
        "....RRRRRRRR....",
        ".....RRRRRR.....",
        "......RRRR......",
        ".......RR.......",
        "................",
      ],
    };
  }
  return {
    id: "main-sprite",
    name: "performer silhouette",
    colors: { K: "shadow", S: "skin", P: "primary", W: "white", A: "accent" },
    rows: [
      "................",
      "......KKKK......",
      ".....KSSSSK.....",
      "......SSSS......",
      ".....KKWWKK.....",
      "....KKKWWKKK....",
      "...KK..WW..KK...",
      "..KK...WW...KK..",
      "......PPPP......",
      ".....PP..PP.....",
      "....PP....PP....",
      "...WW......WW...",
      "................",
    ],
  };
}

function sanitizePixelSprite(rawSprite, fallbackSprite, index) {
  const raw = rawSprite && typeof rawSprite === "object" ? rawSprite : {};
  const fallback = fallbackSprite && typeof fallbackSprite === "object" ? fallbackSprite : {};
  const rowsRaw = Array.isArray(raw.rows) ? raw.rows : Array.isArray(raw.pixels) ? raw.pixels : fallback.rows;
  const rows = Array.isArray(rowsRaw)
    ? rowsRaw
        .slice(0, 28)
        .map((row) => String(row || "").slice(0, 36))
        .filter((row) => row.length >= 3)
    : [];
  const filled = rows.reduce((total, row) => total + Array.from(row).filter((char) => ![".", " ", "_", "0"].includes(char)).length, 0);
  if (rows.length < 3 || filled < 8) return null;
  const rawColors = raw.colors && typeof raw.colors === "object" ? raw.colors : fallback.colors && typeof fallback.colors === "object" ? fallback.colors : {};
  const colors = {};
  Object.entries(rawColors).forEach(([key, value]) => {
    const char = String(key || "").slice(0, 1);
    if (char && ![".", " ", "_", "0"].includes(char)) colors[char] = clipColor(value, `palette${Object.keys(colors).length % 5}`);
  });
  rows.forEach((row) => {
    Array.from(row).forEach((char) => {
      if (![".", " ", "_", "0"].includes(char) && !colors[char]) colors[char] = `palette${Object.keys(colors).length % 5}`;
    });
  });
  return {
    id: clipTextToken(raw.id || raw.name || fallback.id || `sprite-${index}`, `sprite-${index}`).toLowerCase().replace(/[^a-z0-9_-]+/g, "-") || `sprite-${index}`,
    name: clipTextToken(raw.name || fallback.name || `sprite-${index}`, `sprite-${index}`),
    colors,
    rows,
  };
}

function sanitizeSpritePlacement(rawPlacement, spriteIds, index) {
  const raw = rawPlacement && typeof rawPlacement === "object" ? rawPlacement : {};
  if (!spriteIds.length) return null;
  const requested = clipTextToken(raw.sprite || raw.spriteId || raw.sprite_id || spriteIds[0], spriteIds[0]).toLowerCase().replace(/[^a-z0-9_-]+/g, "-");
  const sprite = spriteIds.includes(requested) ? requested : spriteIds[index % spriteIds.length];
  const layer = ["back", "mid", "front"].includes(String(raw.layer || "").toLowerCase()) ? String(raw.layer).toLowerCase() : "mid";
  return {
    id: clipTextToken(raw.id || `${sprite}-${index}`, `${sprite}-${index}`).toLowerCase().replace(/[^a-z0-9_-]+/g, "-") || `${sprite}-${index}`,
    sprite,
    x: clipNumber(raw.x, 0.35, -0.2, 1.1),
    y: clipNumber(raw.y, 0.2, -0.2, 1.1),
    w: clipNumber(raw.w ?? raw.width, 0.3, 0.04, 1.25),
    h: clipNumber(raw.h ?? raw.height, 0.5, 0.04, 1.25),
    layer,
    alpha: clipNumber(raw.alpha, 1, 0, 1),
    motion: sanitizeClipMotion(raw.motion, { mode: "beat-snap", x: 0.02, y: -0.025, scale: 0.08, alpha: 0.12, brightness: 0.18, beat: 1.1, energy: 1, phase: 0 }),
  };
}

function genericSceneClip(seed, index, energy, motifs = [], themeFamily = "song-stage") {
  const token = clipTextToken(motifs[index % Math.max(1, motifs.length)] || state.currentTitle || themeFamily, "PIXEL");
  const sprite = fallbackPixelSprite(seed, token);
  const parts = [
    { id: "backdrop-shadow", type: "rect", x: 0.08, y: 0.16, w: 0.84, h: 0.56, color: "shadow", alpha: 0.42, motion: { mode: "pulse", alpha: 0.12, brightness: 0.1, beat: 0.7 } },
    { id: "left-spotlight", type: "line", x1: 0.2, y1: 0.1, x2: 0.43, y2: 0.62, color: "secondary", alpha: 0.34, width: 0.018, motion: { mode: "flash", brightness: 0.24, beat: 1.1 } },
    { id: "right-spotlight", type: "line", x1: 0.82, y1: 0.1, x2: 0.57, y2: 0.62, color: "accent", alpha: 0.34, width: 0.018, motion: { mode: "flash", brightness: 0.24, beat: 1.1 } },
    { id: "floor-core", type: "poly", points: [[0.24, 0.73], [0.76, 0.73], [0.88, 0.84], [0.12, 0.84]], color: "highlight", alpha: 0.34, motion: { mode: "flash", y: -0.018, scale: 0.08, brightness: 0.34, beat: 1 } },
  ];
  return {
    version: 2,
    subject: token.toLowerCase().replace(/[^a-z0-9_-]+/g, "-") || "pixel-subject",
    sprites: [sprite],
    spritePlacements: [
      {
        id: "main-subject",
        sprite: sprite.id,
        x: 0.34 + seeded(seed, index) * 0.08,
        y: 0.19,
        w: 0.26 + energy * 0.08,
        h: 0.48,
        layer: "mid",
        alpha: 1,
        motion: { mode: "beat-snap", x: 0.018, y: -0.03, scale: 0.08, alpha: 0.1, brightness: 0.22, beat: 1.2, energy: 1, phase: 0 },
      },
    ],
    parts,
  };
}

function sanitizeSceneClip(rawClip, fallbackClip) {
  const fallback = fallbackClip && typeof fallbackClip === "object" ? fallbackClip : genericSceneClip(hashText(state.currentTitle), 0, 0.5);
  const raw = rawClip && typeof rawClip === "object" ? rawClip : {};
  const rawParts = Array.isArray(raw.parts) ? raw.parts : fallback.parts;
  const fallbackParts = Array.isArray(fallback.parts) ? fallback.parts : [];
  const parts = rawParts
    .slice(0, 64)
    .map((part, index) => sanitizeClipPart(part, fallbackParts[index % Math.max(1, fallbackParts.length)], index))
    .filter(Boolean);
  const fallbackSprites = Array.isArray(fallback.sprites) ? fallback.sprites : [];
  const rawSprites = Array.isArray(raw.sprites) ? raw.sprites : Array.isArray(raw.pixelSprites) ? raw.pixelSprites : fallbackSprites;
  const sprites = rawSprites
    .slice(0, 8)
    .map((sprite, index) => sanitizePixelSprite(sprite, fallbackSprites[index % Math.max(1, fallbackSprites.length)], index))
    .filter(Boolean);
  const spriteIds = sprites.map((sprite) => sprite.id);
  const fallbackPlacements = Array.isArray(fallback.spritePlacements) ? fallback.spritePlacements : [];
  const rawPlacements = Array.isArray(raw.spritePlacements) ? raw.spritePlacements : Array.isArray(raw.placements) ? raw.placements : fallbackPlacements;
  let spritePlacements = rawPlacements
    .slice(0, 16)
    .map((placement, index) => sanitizeSpritePlacement(placement, spriteIds, index))
    .filter(Boolean);
  if (sprites.length && !spritePlacements.length) {
    spritePlacements = [sanitizeSpritePlacement({ id: "main-subject", sprite: sprites[0].id, x: 0.36, y: 0.2, w: 0.28, h: 0.5, layer: "mid" }, spriteIds, 0)].filter(Boolean);
  }
  return {
    version: Number.isFinite(Number(raw.version)) ? Number(raw.version) : 2,
    subject: clipTextToken(raw.subject || fallback.subject || "pixel-subject", "pixel-subject"),
    styleNotes: clipTextToken(raw.styleNotes || raw.style_notes || fallback.styleNotes || "", ""),
    sprites,
    spritePlacements,
    parts: parts.length ? parts : fallbackParts.map((part, index) => sanitizeClipPart(part, null, index)).filter(Boolean),
  };
}

function fallbackVisualProfile(duration = estimateDuration(), waveform = state.waveformProfile) {
  const seed = hashText(`${state.currentTitle}|${lyricsInput.value}|${waveform?.signature || "no-wave"}`);
  const motifs = extractVisualTokens();
  const themeFamily = detectThemeFamily(`${state.currentTitle}\n${lyricsInput.value}\n${motifs.join(" ")}`);
  const palette = ensureVibrantPalette(paletteFor(seed));
  const paletteRoles = normalizePaletteRoles(null, palette);
  const brightness = normalizeBrightness(null);
  const count = targetSceneCount(duration);
  const scenes = Array.from({ length: count }, (_, index) => {
    const start = (duration * index) / count;
    const end = index === count - 1 ? duration : (duration * (index + 1)) / count;
    const energy = waveformHintForScene(waveform, index, count);
    const sceneMotifs = Array.from({ length: Math.min(4, motifs.length) }, (_, offset) => motifs[(index + offset) % motifs.length]);
    const clip = genericSceneClip(seed, index, energy, sceneMotifs, themeFamily);
    const keyVisual = fallbackKeyVisual(themeFamily, sceneMotifs, index);
    const lighting = normalizeLighting(null, { intensity: 0.55 + energy * 0.4, colors: paletteRoles }, palette);
    const composition = normalizeComposition(["stage-card", "poster", "object-card", "street-card"][index % 4]);
    return {
      start,
      end,
      kind: "key-visual",
      composition,
      themeFamily,
      primaryMotif: String(sceneMotifs[0] || keyVisual.subject || "song-subject").toLowerCase().replace(/[^a-z0-9_-]+/g, "-"),
      secondaryMotifs: sceneMotifs.slice(0, 2),
      motifs: sceneMotifs.slice(0, 5),
      keyVisual,
      lighting,
      intent: {
        subject: keyVisual.subject,
        setting: keyVisual.setting,
        action: "hold the key visual while light, floor, and camera react to the music",
        props: keyVisual.symbols,
        palette,
        lighting: lighting.base,
        camera: index % 2 ? "push-in" : "hold",
        rhythmTriggers: [
          { trigger: "beat", target: keyVisual.subject, effect: "small glow pulse" },
          { trigger: "peak", target: keyVisual.symbols[0] || keyVisual.subject, effect: "brief flash" },
        ],
        lyricCue: "semantic song image",
        renderNotes: "one readable key visual, bright reactive lighting, no waveform art or readable text",
      },
      motion: "key visual stays readable while waveform drives lighting, flashes, floor glow, and small scale pulses",
      density: Number((0.38 + energy * 0.82).toFixed(3)),
      accent: "waveform peak",
      visual: proceduralVisualBlock(seed, index, energy),
      clip,
    };
  });

  return {
    version: 3,
    source: "fallback",
    vjMode: "key-visual-reactive",
    themeLabel: `视觉 DNA ${(seed & 0xffff).toString(16).padStart(4, "0")}`,
    mood: "song-reactive",
    summary: "无固定歌曲模板；先按歌词和歌名选主视觉，再用波形驱动灯光、闪白、镜头和切段。",
    palette,
    paletteRoles,
    brightness,
    motifs: motifs.slice(0, 8),
    visualDNA: {
      seed,
      engine: "key-visual-reactive-vj",
      themeFamily,
      rules: ["key-visual", "reactive-lighting", "waveform-bins", "lyric-cues", "per-song-seed", "scene-intent"],
    },
    visualScript: {
      logline: "song-specific key visuals staged against beat-reactive light",
      artDirection: "large readable pixel key visual, solid glowing tiles, brighter background, no readable artwork text",
      motionStrategy: "lighting, floor glow, camera pulse, and flashes respond to waveform peaks and lyric entries",
    },
    scenes,
  };
}

function normalizeSceneVisual(rawVisual, fallbackVisual) {
  const raw = rawVisual && typeof rawVisual === "object" ? rawVisual : {};
  const layout = proceduralLayouts.includes(String(raw.layout)) ? String(raw.layout) : fallbackVisual.layout;
  return {
    seed: Number.isFinite(Number(raw.seed)) ? Number(raw.seed) >>> 0 : fallbackVisual.seed,
    layout,
    turbulence: clamp(Number(raw.turbulence ?? fallbackVisual.turbulence), 0, 2),
    symmetry: clamp(Number(raw.symmetry ?? fallbackVisual.symmetry), 0, 1),
    scale: clamp(Number(raw.scale ?? fallbackVisual.scale), 0.25, 2.5),
    colorShift: clamp(Number(raw.colorShift ?? fallbackVisual.colorShift), 0, 1),
    beatLock: String(raw.beatLock || fallbackVisual.beatLock || "waveform-peaks").slice(0, 48),
  };
}

function normalizeVisualProfile(profile, duration = estimateDuration(), waveform = null) {
  const fallback = fallbackVisualProfile(duration, waveform);
  const source = profile && typeof profile === "object" ? profile : fallback;
  const palette = ensureVibrantPalette(Array.isArray(source.palette) && source.palette.length >= 3 ? source.palette.slice(0, 6) : fallback.palette);
  const paletteRoles = normalizePaletteRoles(source.paletteRoles || source.palette_roles, palette);
  const brightness = normalizeBrightness(source.brightness);
  const sourceThemeFamily = normalizeThemeFamilyName(source.themeFamily || source.visualDNA?.themeFamily || fallback.visualDNA?.themeFamily || detectThemeFamily());
  let scenes = Array.isArray(source.scenes) ? source.scenes : [];
  scenes = scenes
    .map((scene, index) => {
      const fallbackScene = fallback.scenes[index % fallback.scenes.length];
      const themeFamily = normalizeThemeFamilyName(scene.themeFamily || sourceThemeFamily || fallbackScene.themeFamily || "song-stage");
      const sceneMotifs = Array.isArray(scene.motifs) ? scene.motifs.slice(0, 5).map((item) => String(item).slice(0, 32)) : fallbackScene.motifs;
      const composition = normalizeComposition(scene.composition, fallbackScene.composition || "poster");
      const keyVisual = normalizeKeyVisual(scene.keyVisual || scene.key_visual, fallbackScene.keyVisual || fallbackKeyVisual(themeFamily, sceneMotifs, index));
      const lighting = normalizeLighting(scene.lighting, fallbackScene.lighting, palette);
      return {
        start: clamp(Number(scene.start ?? (duration * index) / Math.max(1, scenes.length)), 0, duration),
        end: clamp(Number(scene.end ?? (duration * (index + 1)) / Math.max(1, scenes.length)), 0, duration),
        kind: "key-visual",
        composition,
        themeFamily,
        intent: scene.intent && typeof scene.intent === "object" ? { ...scene.intent } : fallbackScene.intent || null,
        keyVisual,
        lighting,
        primaryMotif: String(scene.primaryMotif || scene.primary_motif || fallbackScene.primaryMotif || keyVisual.subject || "song-subject").slice(0, 48),
        secondaryMotifs: Array.isArray(scene.secondaryMotifs) ? scene.secondaryMotifs.slice(0, 3).map((item) => String(item).slice(0, 32)) : fallbackScene.secondaryMotifs || [],
        motifs: sceneMotifs,
        motion: String(scene.motion || "waveform reactive").slice(0, 120),
        density: clamp(Number(scene.density || fallbackScene.density || 0.72), 0.2, 1.4),
        accent: String(scene.accent || "").slice(0, 80),
        visual: normalizeSceneVisual(scene.visual, fallbackScene.visual),
        clip: sanitizeSceneClip(scene.clip || scene.visual?.clip, fallbackScene.clip),
      };
    })
    .filter((scene) => scene.end > scene.start);

  if (!scenes.length) scenes = fallback.scenes;
  scenes.sort((a, b) => a.start - b.start);
  scenes = normalizeSceneTimeline(scenes, fallback.scenes, duration);

  return {
    version: Number(source.version || 3),
    source: source.source || fallback.source,
    vjMode: source.vjMode || source.vj_mode || fallback.vjMode || "key-visual-reactive",
    themeLabel: source.themeLabel || fallback.themeLabel,
    mood: source.mood || fallback.mood,
    summary: source.summary || fallback.summary,
    palette,
    paletteRoles,
    brightness,
    motifs: Array.isArray(source.motifs) ? source.motifs.slice(0, 8) : fallback.motifs,
    visualScript: source.visualScript && typeof source.visualScript === "object" ? { ...source.visualScript } : fallback.visualScript,
    visualDNA: source.visualDNA && typeof source.visualDNA === "object" ? { ...source.visualDNA, themeFamily: sourceThemeFamily } : fallback.visualDNA,
    scenes,
    duration,
    waveform: waveform || source.waveform || null,
    cueSignature: cueSignature(),
    lyricsSignature: lyricsSignature(),
  };
}

function visualPlanKey(duration = estimateDuration(), waveform = null) {
  return `${lyricArtist.value.trim()}|${lyricTitle.value.trim()}|${state.currentTitle}|${Math.round(duration * 10) / 10}|${waveform?.signature || "no-wave"}|${cueSignature()}|${lyricsInput.value.trim()}`;
}

async function requestVisualPlan(duration = estimateDuration(), options = {}) {
  const lyrics = lyricsInput.value.trim();
  if (!lyrics) {
    invalidateVisualPlan("等待歌词：没有歌词时不会生成歌词动画分镜。", { forceStatus: true });
    scheduleProjectSave();
    return null;
  }
  if (!state.lyricCues.length) await buildLyricCues({ silent: true });
  if (!state.lyricCues.length) {
    invalidateVisualPlan("等待字幕时间轴：一键制作会先生成时间轴，再生成动画。", { forceStatus: true });
    return null;
  }

  setStatus(contentStatus, "正在提取波形摘要，随后生成动画分镜。");
  const waveform = await buildWaveformProfile(duration);
  state.waveformProfile = waveform;
  const key = visualPlanKey(duration, waveform);
  if (!options.force && visualPlanReady() && state.visualPlanKey === key) {
    updatePipelineStatus();
    scheduleProjectSave();
    return state.visualPlan;
  }

  setStatus(contentStatus, waveform ? "Codex 正在根据歌词和波形生成动画分镜。" : "Codex 正在根据歌词生成动画分镜；暂时等待波形，用歌词节奏兜底。");
  try {
    const response = await fetch("/api/visual-plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        artist: lyricArtist.value.trim(),
        trackTitle: lyricTitle.value.trim(),
        title: [lyricArtist.value.trim(), lyricTitle.value.trim()].filter(Boolean).join(" - ") || state.currentTitle,
        lyrics,
        duration,
        waveform,
      }),
    });
    const plan = await response.json();
    if (!response.ok) throw new Error(plan.error || "视觉分镜生成失败");
    state.visualPlan = normalizeVisualProfile(plan, duration, waveform);
    state.visualPlanKey = key;
    const source = state.visualPlan.source === "codex" ? "Codex 分镜" : "本地兜底";
    const perMinute = ((state.visualPlan.scenes.length / Math.max(duration, 1)) * 60).toFixed(1);
    setStatus(contentStatus, `已使用${source}：${state.visualPlan.themeLabel}，${state.visualPlan.scenes.length} 个主视觉段落，约 ${perMinute} 段/分钟；${waveform ? "波形已接入" : "等待波形"}。`);
  } catch (error) {
    state.visualPlan = normalizeVisualProfile(null, duration, waveform);
    state.visualPlanKey = key;
    const perMinute = ((state.visualPlan.scenes.length / Math.max(duration, 1)) * 60).toFixed(1);
    setStatus(contentStatus, `Codex 分镜失败，已用本地兜底：${error.message || "未知错误"}；${state.visualPlan.scenes.length} 段，约 ${perMinute} 段/分钟；${waveform ? "波形已接入" : "等待波形"}。`);
  }
  updatePipelineStatus();
  scheduleProjectSave();
  return state.visualPlan;
}

function visualProfile() {
  if (visualPlanReady()) return state.visualPlan;
  const duration = estimateDuration();
  const key = `fallback|${visualPlanKey(duration)}`;
  if (!state.contentProfile || state.contentProfileKey !== key) {
    state.contentProfile = normalizeVisualProfile(null, duration, state.waveformProfile);
    state.contentProfileKey = key;
  }
  return state.contentProfile;
}

async function ensureAnimationReady(options = {}) {
  if (!hasLyricText()) {
    invalidateVisualPlan("等待歌词：没有歌词时不会预览或导出歌词动画。", { forceStatus: true });
    throw new Error("还没有歌词，不能预览或导出歌词动画。");
  }

  setStatus(contentStatus, "正在确认字幕时间轴。");
  await buildLyricCues({ silent: true });
  if (!state.lyricCues.length) {
    invalidateVisualPlan("等待字幕时间轴：一键制作会自动生成。", { forceStatus: true });
    throw new Error("字幕时间轴还没有生成。");
  }

  const duration = Number(options.duration || estimateDuration());
  const plan = await requestVisualPlan(duration, { force: Boolean(options.force) });
  if (!plan || !visualPlanReady()) {
    throw new Error("动画分镜还没有准备好。");
  }
  return plan;
}

function sceneAt(time, profile) {
  const scenes = profile.scenes || [];
  return scenes.find((scene) => time >= scene.start && time < scene.end) || scenes[scenes.length - 1] || null;
}

function cueIndexAt(time) {
  if (!state.lyricCues.length) return -1;
  const index = state.lyricCues.findIndex((cue) => time >= cue.start && time < cue.end);
  if (index >= 0) return index;
  return time < state.lyricCues[0].start ? 0 : state.lyricCues.length - 1;
}

function cueProgress(cue, time) {
  if (!cue) return 0;
  return clamp((time - cue.start) / Math.max(0.1, cue.end - cue.start), 0, 1);
}

function bufferEnergyAt(buffer, time) {
  if (!buffer || !Number.isFinite(time)) return 0;
  const sampleRate = buffer.sampleRate;
  const channel = buffer.getChannelData(0);
  const center = Math.floor(clamp(time, 0, buffer.duration || 0) * sampleRate);
  const span = Math.max(256, Math.floor(sampleRate * 0.045));
  const start = clamp(center - Math.floor(span / 2), 0, Math.max(0, channel.length - 1));
  const end = clamp(start + span, 0, channel.length);
  const step = Math.max(1, Math.floor((end - start) / 220));
  let sum = 0;
  let count = 0;
  for (let index = start; index < end; index += step) {
    const sample = channel[index] || 0;
    sum += sample * sample;
    count += 1;
  }
  return clamp(Math.sqrt(sum / Math.max(1, count)) * 8.5, 0, 1);
}

function segmentEnergyAt(time) {
  const segments = state.acapellaSegments || [];
  let energy = 0;
  segments.forEach((segment) => {
    if (time >= segment.start && time <= segment.end) {
      const phase = (time - segment.start) / Math.max(0.1, segment.end - segment.start);
      energy = Math.max(energy, 0.45 + Math.sin(phase * Math.PI) * 0.55);
      return;
    }
    const distance = Math.min(Math.abs(time - segment.start), Math.abs(time - segment.end));
    if (distance < 0.35) {
      energy = Math.max(energy, 1 - distance / 0.35);
    }
  });
  return energy;
}

function waveformEnergyAt(profile, time) {
  const waveform = profile?.waveform || state.waveformProfile;
  const bins = Array.isArray(waveform?.bins) ? waveform.bins : [];
  const duration = Number(waveform?.duration || profile?.duration || estimateDuration());
  if (!bins.length || !Number.isFinite(duration) || duration <= 0) return 0;
  const position = clamp((time / duration) * (bins.length - 1), 0, bins.length - 1);
  const left = Math.floor(position);
  const right = Math.min(bins.length - 1, left + 1);
  const mix = position - left;
  return clamp((Number(bins[left]) || 0) * (1 - mix) + (Number(bins[right]) || 0) * mix, 0, 1);
}

function waveformAnalysis(profile) {
  const waveform = profile?.waveform || state.waveformProfile || profile;
  if (!waveform || typeof waveform !== "object") return {};
  return waveform.analysis && typeof waveform.analysis === "object" ? waveform.analysis : waveform;
}

function curveValueAt(curve, time) {
  if (!Array.isArray(curve) || !curve.length) return 0;
  if (curve.length === 1) return clamp(Number(curve[0].value) || 0, 0, 1);
  let previous = curve[0];
  for (let index = 1; index < curve.length; index += 1) {
    const next = curve[index];
    const nextTime = Number(next.time || 0);
    if (time <= nextTime) {
      const previousTime = Number(previous.time || 0);
      const span = Math.max(0.001, nextTime - previousTime);
      const mix = clamp((time - previousTime) / span, 0, 1);
      return clamp((Number(previous.value) || 0) * (1 - mix) + (Number(next.value) || 0) * mix, 0, 1);
    }
    previous = next;
  }
  return clamp(Number(previous.value) || 0, 0, 1);
}

function pulseFromTimes(times, time, window = 0.16) {
  if (!Array.isArray(times) || !times.length) return 0;
  let pulse = 0;
  for (let index = 0; index < times.length; index += 1) {
    const itemTime = Number(times[index]);
    if (!Number.isFinite(itemTime)) continue;
    const distance = Math.abs(time - itemTime);
    if (distance < window) pulse = Math.max(pulse, 1 - distance / window);
    if (itemTime > time + window) break;
  }
  return clamp(pulse, 0, 1);
}

function rhythmPulseAt(profile, time) {
  const analysis = waveformAnalysis(profile);
  return pulseFromTimes(analysis.beatTimes, time, 0.13);
}

function barPulseAt(profile, time) {
  const analysis = waveformAnalysis(profile);
  return pulseFromTimes(analysis.barTimes, time, 0.28);
}

function onsetPulseAt(profile, time) {
  const analysis = waveformAnalysis(profile);
  return curveValueAt(analysis.onsetCurve, time);
}

function sectionAtTime(profile, time) {
  const analysis = waveformAnalysis(profile);
  const sections = Array.isArray(analysis.sections) ? analysis.sections : [];
  return sections.find((section) => time >= Number(section.start || 0) && time < Number(section.end || 0)) || sections[sections.length - 1] || null;
}

function rhythmStateAt(profile, time) {
  const section = sectionAtTime(profile, time);
  return {
    beat: rhythmPulseAt(profile, time),
    bar: barPulseAt(profile, time),
    onset: onsetPulseAt(profile, time),
    section,
    sectionIntensity: clamp(Number(section?.intensity ?? waveformEnergyAt(profile, time)), 0, 1),
  };
}

function waveformPeakPulse(profile, time) {
  const waveform = profile?.waveform || state.waveformProfile;
  const peaks = Array.isArray(waveform?.peaks) ? waveform.peaks : [];
  let pulse = 0;
  peaks.forEach((peak) => {
    const peakTime = Number(peak.time || 0);
    const value = Number(peak.value || 0.7);
    const distance = Math.abs(time - peakTime);
    if (distance < 0.42) {
      pulse = Math.max(pulse, (1 - distance / 0.42) * clamp(value, 0, 1));
    }
  });
  pulse = Math.max(pulse, rhythmPulseAt(profile, time) * 0.58, onsetPulseAt(profile, time) * 0.42);
  return clamp(pulse, 0, 1);
}

function visualEnergy(time, cue, seed, profile) {
  const rhythm = rhythmStateAt(profile, time);
  const audioEnergy = Math.max(
    waveformEnergyAt(profile, time),
    bufferEnergyAt(state.backingBuffer, time),
    bufferEnergyAt(state.acapellaBuffer, time),
    segmentEnergyAt(time) * 0.82,
  );
  const lyricHit = cue ? Math.max(0, 1 - Math.abs(cueProgress(cue, time) - 0.08) / 0.16) : 0;
  const peakHit = waveformPeakPulse(profile, time);
  const beatRate = 1.35 + seeded(seed, 4) * 1.15;
  const clock = 0.02 + 0.025 * Math.max(0, Math.sin(time * Math.PI * 2 * beatRate));
  return clamp(audioEnergy + peakHit * 0.42 + rhythm.beat * 0.2 + rhythm.bar * 0.24 + rhythm.onset * 0.18 + lyricHit * 0.34 + clock, 0, 1);
}

function drawScreenBase(w, h, time, palette, energy, intensity) {
  rect(0, 0, w, h, "#020306");
  for (let y = 0; y < h; y += 12) {
    rect(0, y, w, 2, y % 24 === 0 ? "#ffffff" : palette[1], y % 24 === 0 ? 0.018 : 0.006);
  }
  rect(0, 0, w, h, palette[0], 0.012 + energy * 0.018);
}

function drawStageVignette(w, h, palette, energy = 0, beatBurst = 0) {
  const glow = clamp(Number(energy) || 0, 0, 1);
  const burst = clamp(Number(beatBurst) || 0, 0, 1);
  rect(0, 0, w, h, "#020306", 0.1);
  rect(0, 0, w, h * 0.13, "#000000", 0.28);
  rect(0, h * 0.82, w, h * 0.18, "#000000", 0.34);
  rect(0, 0, w * 0.08, h, "#000000", 0.22);
  rect(w * 0.92, 0, w * 0.08, h, "#000000", 0.22);
  drawLine(w * 0.2, h * 0.08, w * 0.46, h * 0.58, palette[1] || "#4fd8ff", 0.12 + glow * 0.16 + burst * 0.24, 8 + burst * 10);
  drawLine(w * 0.8, h * 0.08, w * 0.54, h * 0.58, palette[2] || "#ff5d9d", 0.12 + glow * 0.16 + burst * 0.24, 8 + burst * 10);
  rect(w * 0.1, h * 0.74, w * 0.8, 4 + glow * 8, palette[0] || "#45f5a1", 0.16 + glow * 0.18);
  strokeRect(18, 18, w - 36, h - 36, palette[1] || "#4fd8ff", 0.05 + burst * 0.08, 2);
}

function stagePoint(w, h, x, y) {
  return [Math.round((x / 320) * w), Math.round((y / 240) * h)];
}

function stageSize(w, h, width, height) {
  return [Math.max(1, Math.round((width / 320) * w)), Math.max(1, Math.round((height / 240) * h))];
}

function stageRect(w, h, x, y, width, height, color, alpha = 1) {
  const [px, py] = stagePoint(w, h, x, y);
  const [pw, ph] = stageSize(w, h, width, height);
  rect(px, py, pw, ph, color, alpha);
}

function stageLine(w, h, x1, y1, x2, y2, color, alpha = 1, lineWidth = 2) {
  const [px1, py1] = stagePoint(w, h, x1, y1);
  const [px2, py2] = stagePoint(w, h, x2, y2);
  drawLine(px1, py1, px2, py2, color, alpha, Math.max(1, (lineWidth / 240) * h));
}

function stagePoly(w, h, points, color, alpha = 1) {
  fillPolygon(points.map(([x, y]) => stagePoint(w, h, x, y)), color, alpha);
}

function stagePixelDisk(w, h, cx, cy, radius, color, alpha = 1, step = 3) {
  const safeRadius = Math.max(1, radius);
  for (let y = -safeRadius; y <= safeRadius; y += step) {
    const half = Math.sqrt(Math.max(0, safeRadius * safeRadius - y * y));
    stageRect(w, h, cx - half, cy + y, half * 2, Math.max(1, step), color, alpha);
  }
}

function expandStagePoints(points, amount) {
  const center = points.reduce((total, point) => [total[0] + point[0], total[1] + point[1]], [0, 0]);
  center[0] /= Math.max(1, points.length);
  center[1] /= Math.max(1, points.length);
  return points.map(([x, y]) => [center[0] + (x - center[0]) * (1 + amount), center[1] + (y - center[1]) * (1 + amount)]);
}

function drawSolidGlowTile(w, h, points, color, hit, alpha = 0.9) {
  const pulse = clamp(hit, 0, 1.4);
  stagePoly(w, h, expandStagePoints(points, 0.24 + pulse * 0.12), color, 0.07 + pulse * 0.08);
  stagePoly(w, h, expandStagePoints(points, 0.12 + pulse * 0.08), color, 0.13 + pulse * 0.1);
  stagePoly(w, h, points, color, alpha);
  stageLine(w, h, points[0][0] + 2, points[0][1] + 2, points[1][0] - 2, points[1][1] + 2, "#fff6b0", 0.28 + pulse * 0.12, 2);
}

function drawPixelSpark(w, h, x, y, size, color, alpha = 0.85) {
  stageRect(w, h, x - size, y, size * 2 + 1, 2, color, alpha);
  stageRect(w, h, x, y - size, 2, size * 2 + 1, color, alpha);
}

function drawLine(x1, y1, x2, y2, color, alpha = 1, lineWidth = 2) {
  const oldAlpha = ctx2d.globalAlpha;
  ctx2d.globalAlpha = alpha;
  ctx2d.strokeStyle = color;
  ctx2d.lineWidth = lineWidth;
  ctx2d.beginPath();
  ctx2d.moveTo(x1, y1);
  ctx2d.lineTo(x2, y2);
  ctx2d.stroke();
  ctx2d.globalAlpha = oldAlpha;
}

function fillPolygon(points, color, alpha = 1) {
  if (!points.length) return;
  const oldAlpha = ctx2d.globalAlpha;
  ctx2d.globalAlpha = alpha;
  ctx2d.fillStyle = color;
  ctx2d.beginPath();
  ctx2d.moveTo(points[0][0], points[0][1]);
  points.slice(1).forEach(([x, y]) => ctx2d.lineTo(x, y));
  ctx2d.closePath();
  ctx2d.fill();
  ctx2d.globalAlpha = oldAlpha;
}

function resolveClipColor(value, palette, seed = 0) {
  const colors = Array.isArray(palette) && palette.length ? palette : paletteFor(seed);
  const raw = String(value || "primary").trim().toLowerCase();
  const paletteMatch = raw.match(/^palette[:.-]?(\d+)$/) || raw.match(/^palette(\d+)$/);
  if (paletteMatch) return colors[Number(paletteMatch[1]) % colors.length] || colors[0] || "#45f5a1";
  if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(raw)) return raw;
  const tokens = {
    primary: colors[0] || "#45f5a1",
    secondary: colors[1] || "#4fd8ff",
    accent: colors[2] || "#ff5d9d",
    highlight: colors[3] || "#ffd166",
    shadow: "#05070b",
    skin: "#ffd1a3",
    hair: "#17100c",
    warm: colors[3] || "#ffd166",
    light: "#f4f7fb",
    dark: "#05070b",
    black: "#020306",
    white: "#ffffff",
    red: "#ff315a",
    blue: "#4fd8ff",
    yellow: "#ffd166",
    green: "#45f5a1",
  };
  return tokens[raw] || colors[(hashText(raw) + seed) % colors.length] || "#45f5a1";
}

function clipMotionState(motion, time, seed, energy, beatBurst, intensity) {
  const rawMode = typeof motion === "string" ? motion : motion?.mode;
  const mode = String(rawMode || "pulse").toLowerCase();
  const speed = typeof motion === "object" ? Number(motion.speed || 1) : 1;
  const phaseOffset = typeof motion === "object" ? Number(motion.phase || 0) * Math.PI * 2 : 0;
  const energyWeight = typeof motion === "object" ? Number(motion.energy ?? 1) : 1;
  const beatWeight = typeof motion === "object" ? Number(motion.beat ?? 1) : 1;
  const phase = Math.sin(time * Math.PI * 2 * clamp(speed, 0.1, 8) + seed * 0.0001 + phaseOffset);
  const wave = Math.sin(time * (0.7 + seeded(seed, 5) * 1.3) + seed * 0.0003);
  const reactive = clamp((energy * energyWeight + beatBurst * beatWeight) * 0.5, 0, 1.8) * clamp(intensity, 0.2, 2.5);
  const objectMotion = motion && typeof motion === "object" ? motion : {};
  const dxBase = Number(objectMotion.x || 0);
  const dyBase = Number(objectMotion.y || 0);
  const scaleBase = Number(objectMotion.scale || 0);
  const alphaBase = Number(objectMotion.alpha || 0);
  const brightBase = Number(objectMotion.brightness || 0);
  const waveX = mode.includes("drift") || mode.includes("wave") ? wave * 0.018 : 0;
  const waveY = mode.includes("bounce") || mode.includes("wave") ? phase * 0.014 : 0;
  const beatScale = mode.includes("scale") || mode.includes("pulse") || mode.includes("flash") ? reactive * 0.08 : 0;
  const beatAlpha = mode.includes("flash") || mode.includes("glow") || mode.includes("pulse") ? beatBurst * 0.32 + energy * 0.08 : 0;
  return {
    dx: dxBase * reactive + waveX,
    dy: dyBase * reactive + waveY,
    scale: 1 + clamp(scaleBase * reactive + beatScale, -0.35, 0.85),
    alpha: clamp(alphaBase * reactive + beatAlpha, 0, 0.85),
    brightness: clamp(brightBase * reactive + beatBurst * 0.28, 0, 0.95),
  };
}

function clipPartCenter(part) {
  if (part.type === "rect") return [part.x + part.w / 2, part.y + part.h / 2];
  if (part.type === "line") return [(part.x1 + part.x2) / 2, (part.y1 + part.y2) / 2];
  if (part.type === "poly") {
    const points = Array.isArray(part.points) ? part.points : [];
    const sum = points.reduce((total, point) => [total[0] + point[0], total[1] + point[1]], [0, 0]);
    return points.length ? [sum[0] / points.length, sum[1] / points.length] : [0.5, 0.5];
  }
  return [part.x || 0.5, part.y || 0.5];
}

function drawClipPart(part, w, h, time, seed, palette, energy, beatBurst, intensity, index) {
  if (!part || typeof part !== "object" || !["rect", "line", "poly"].includes(part.type)) return false;
  const motion = clipMotionState(part.motion, time, seed + index * 101, energy, beatBurst, intensity);
  const color = resolveClipColor(part.color, palette, seed + index);
  const alpha = clamp(Number(part.alpha ?? 0.8) + motion.alpha + motion.brightness * 0.16, 0, 1);
  const [cxNorm, cyNorm] = clipPartCenter(part);
  const cx = cxNorm * w;
  const cy = cyNorm * h;

  ctx2d.save();
  try {
    ctx2d.translate(cx + motion.dx * w, cy + motion.dy * h);
    ctx2d.scale(motion.scale, motion.scale);
    ctx2d.translate(-cx, -cy);

    if (part.type === "rect") {
      rect(part.x * w, part.y * h, part.w * w, part.h * h, color, alpha);
    } else if (part.type === "line") {
      drawLine(part.x1 * w, part.y1 * h, part.x2 * w, part.y2 * h, color, alpha, Math.max(1, part.width * Math.min(w, h)));
    } else if (part.type === "poly") {
      fillPolygon(part.points.map(([x, y]) => [x * w, y * h]), color, alpha);
    }

    if (motion.brightness > 0.08) {
      rect(cx - 4 - motion.brightness * 18, cy - 4 - motion.brightness * 18, 8 + motion.brightness * 36, 8 + motion.brightness * 36, "#ffffff", motion.brightness * 0.08);
    }
  } finally {
    ctx2d.restore();
  }
  return true;
}

function drawPixelDirectorBackground(w, h, time, profile, segment, palette, energy, beatBurst, seed, rhythm = {}) {
  const barHit = clamp(Number(rhythm.bar) || 0, 0, 1);
  const onsetHit = clamp(Number(rhythm.onset) || 0, 0, 1);
  const sectionIntensity = clamp(Number(rhythm.sectionIntensity) || 0, 0, 1);
  const hit = clamp(energy * 0.62 + beatBurst * 0.9 + barHit * 0.65 + onsetHit * 0.22, 0, 1.45);
  const cameraPush = Math.round(barHit * 4);
  const theme = String(segment?.themeFamily || profile?.visualDNA?.themeFamily || profile?.themeLabel || "").toLowerCase();
  const night = theme.includes("night") || theme.includes("urban") || theme.includes("pop") || theme.includes("dance");
  rect(0, 0, w, h, night ? "#070821" : "#0a1020", 0.96);
  for (let y = 8 - cameraPush; y < 236; y += 4) {
    stageRect(w, h, 0, y, 320, 1, palette[(y / 4) % palette.length] || "#39d7ff", 0.014 + hit * 0.012);
  }

  const skylineSeed = seed >>> 0;
  for (let index = 0; index < 12; index += 1) {
    const x = index * 29 - 8;
    const height = 22 + Math.floor(seeded(skylineSeed + 41, index) * 55);
    const y = 105 - height + cameraPush;
    stageRect(w, h, x, y, 12 + Math.floor(seeded(skylineSeed + 71, index) * 18), height, index % 2 ? "#040614" : "#02030a", 0.68 + sectionIntensity * 0.08);
  }
  stageRect(w, h, 0, 103, 320, 9, "#020306", 0.78);

  const leftColor = palette[1] || "#39d7ff";
  const rightColor = palette[2] || "#ff3f76";
  stagePoly(w, h, [[28, 0], [45, 0], [82 + cameraPush, 142], [65, 148]], leftColor, 0.1 + hit * 0.08 + barHit * 0.06);
  stagePoly(w, h, [[258, 0], [278, 0], [205 - cameraPush, 148], [190, 142]], rightColor, 0.1 + hit * 0.08 + barHit * 0.06);

  const tileA = palette[3] || "#ffe36d";
  const tileB = palette[0] || "#48f7a8";
  const tileC = palette[1] || "#39d7ff";
  const floorTop = 121 + cameraPush;
  stagePoly(w, h, [[0, floorTop], [320, floorTop], [320, 236], [0, 236]], "#02040a", 0.8);
  drawSolidGlowTile(w, h, [[22, 154 + cameraPush], [94, 148 + cameraPush], [108, 166 + cameraPush], [14, 175 + cameraPush]], tileA, hit * 0.78 + barHit * 0.18, 0.48 + hit * 0.16);
  drawSolidGlowTile(w, h, [[104, 150 + cameraPush], [176, 149 + cameraPush], [181, 170 + cameraPush], [98, 168 + cameraPush]], tileB, hit + barHit * 0.22, 0.58 + hit * 0.16);
  drawSolidGlowTile(w, h, [[182, 150 + cameraPush], [301, 152 + cameraPush], [313, 171 + cameraPush], [183, 170 + cameraPush]], tileC, hit * 0.82 + barHit * 0.18, 0.5 + hit * 0.16);
  for (let row = 0; row < 3; row += 1) {
    const y = 178 + row * 18 + cameraPush;
    const rowAlpha = 0.08 + sectionIntensity * 0.04 + hit * 0.03;
    for (let x = -14 + (row % 2) * 16; x < 330; x += 34) {
      const color = palette[(row + Math.floor(x / 34) + 8) % palette.length] || tileB;
      stagePoly(w, h, [[x, y], [x + 28, y - 4], [x + 42, y + 9], [x + 10, y + 13]], color, rowAlpha + barHit * 0.05);
    }
  }
  for (let x = -20; x <= 340; x += 28) {
    stageLine(w, h, x, 119 + cameraPush, x - 24, 236, "#143a57", 0.1 + hit * 0.03, 1);
  }
}

function spritePixelBounds(sprite) {
  const rows = Array.isArray(sprite?.rows) ? sprite.rows : [];
  const width = rows.reduce((max, row) => Math.max(max, String(row).length), 0);
  return { rows, cols: width, rowCount: rows.length };
}

function drawPixelSprite(sprite, x, y, width, height, palette, seed, alpha = 1, brightness = 0) {
  const { rows, cols, rowCount } = spritePixelBounds(sprite);
  if (!rows.length || !cols) return false;
  const cellW = width / cols;
  const cellH = height / rowCount;
  const colors = sprite.colors && typeof sprite.colors === "object" ? sprite.colors : {};
  rows.forEach((row, rowIndex) => {
    Array.from(String(row).padEnd(cols, ".").slice(0, cols)).forEach((char, colIndex) => {
      if ([".", " ", "_", "0"].includes(char)) return;
      const color = resolveClipColor(colors[char] || `palette${(char.charCodeAt(0) + seed) % Math.max(1, palette.length)}`, palette, seed + char.charCodeAt(0));
      rect(x + colIndex * cellW, y + rowIndex * cellH, Math.ceil(cellW) + 0.5, Math.ceil(cellH) + 0.5, color, alpha);
      if (brightness > 0.05) {
        rect(x + colIndex * cellW, y + rowIndex * cellH, Math.ceil(cellW) + 0.5, Math.ceil(cellH) + 0.5, "#ffffff", brightness * 0.18);
      }
    });
  });
  return true;
}

function drawSpritePlacement(placement, spritesById, w, h, time, seed, palette, energy, beatBurst, intensity, index) {
  const sprite = spritesById.get(placement.sprite);
  if (!sprite) return false;
  const motion = clipMotionState(placement.motion, time, seed + index * 211, energy, beatBurst, intensity);
  const px = placement.x * w;
  const py = placement.y * h;
  const pw = placement.w * w;
  const ph = placement.h * h;
  const cx = px + pw / 2;
  const cy = py + ph / 2;
  const alpha = clamp(Number(placement.alpha ?? 1) + motion.alpha * 0.35, 0, 1);

  ctx2d.save();
  try {
    ctx2d.translate(cx + motion.dx * w, cy + motion.dy * h);
    ctx2d.scale(motion.scale, motion.scale);
    ctx2d.translate(-cx, -cy);
    const shadowColor = resolveClipColor("shadow", palette, seed);
    rect(px + pw * 0.16, py + ph * 0.92, pw * 0.68, Math.max(3, ph * 0.035), shadowColor, 0.25 + energy * 0.16);
    if (motion.brightness > 0.04 || beatBurst > 0.08) {
      rect(px - pw * 0.07, py - ph * 0.07, pw * 1.14, ph * 1.14, palette[(index + 1) % palette.length] || "#39d7ff", 0.05 + motion.brightness * 0.1 + beatBurst * 0.05);
    }
    return drawPixelSprite(sprite, px, py, pw, ph, palette, seed + index, alpha, motion.brightness + beatBurst * 0.25);
  } finally {
    ctx2d.restore();
  }
}

function isEnvironmentPart(part) {
  const id = String(part?.id || "").toLowerCase();
  if (/floor|tile|ground|light|glow|beam|shadow|back|sky|road|street|window|room|door|moon|sun|spark|flash|set|stage/.test(id)) return true;
  return Number(part?.alpha ?? 1) <= 0.45;
}

function drawPixelSpriteScene(clip, w, h, time, seed, profile, segment, palette, energy, beatBurst, intensity) {
  const safeClip = sanitizeSceneClip(clip, genericSceneClip(seed, 0, energy, segment?.motifs || profile?.motifs || [], segment?.themeFamily || "song-stage"));
  if (!safeClip.sprites?.length || !safeClip.spritePlacements?.length) return false;
  const rhythm = rhythmStateAt(profile, time);
  const reactiveBeat = Math.max(beatBurst, rhythm.beat * 0.72, rhythm.bar * 1.05, rhythm.onset * 0.82);
  drawPixelDirectorBackground(w, h, time, profile, segment, palette, energy, reactiveBeat, seed, rhythm);

  safeClip.parts.filter(isEnvironmentPart).forEach((part, index) => {
    try {
      drawClipPart(part, w, h, time, seed + 7000, palette, energy, reactiveBeat, intensity, index);
    } catch (error) {
      state.lastVisualRenderError = error?.message || String(error);
    }
  });

  const spritesById = new Map(safeClip.sprites.map((sprite) => [sprite.id, sprite]));
  const layerOrder = { back: 0, mid: 1, front: 2 };
  let drawn = 0;
  safeClip.spritePlacements
    .slice()
    .sort((a, b) => (layerOrder[a.layer] ?? 1) - (layerOrder[b.layer] ?? 1))
    .forEach((placement, index) => {
      try {
        if (drawSpritePlacement(placement, spritesById, w, h, time, seed, palette, energy, reactiveBeat, intensity, index)) drawn += 1;
      } catch (error) {
        state.lastVisualRenderError = error?.message || String(error);
      }
    });
  if (drawn) {
    const hit = clamp(energy * 0.4 + reactiveBeat * 0.85, 0, 1);
    if (hit > 0.16) rect(0, 0, w, h, "#ffffff", hit * 0.03);
    if (reactiveBeat > 0.2) drawPixelSpark(w, h, 38 + seeded(seed, 2) * 240, 86 + seeded(seed, 3) * 70, 5 + reactiveBeat * 4, palette[3] || "#ffe36d", 0.42 + reactiveBeat * 0.24);
  }
  return drawn > 0;
}

function drawEmergencyPixelSubject(w, h, time, seed, palette, energy, beatBurst, label = "PIXEL MV") {
  const cx = w * (0.5 + Math.sin(time * 0.9 + seed) * 0.025);
  const baseY = h * 0.72;
  const unit = Math.max(6, Math.min(w, h) * 0.012);
  rect(w * 0.12, h * 0.16, w * 0.76, h * 0.52, "#05070b", 0.58);
  drawLine(w * 0.22, h * 0.14, cx - unit * 2, baseY - unit * 18, palette[1] || "#4fd8ff", 0.46 + beatBurst * 0.24, 12 + beatBurst * 10);
  drawLine(w * 0.78, h * 0.14, cx + unit * 2, baseY - unit * 18, palette[2] || "#ff5d9d", 0.46 + beatBurst * 0.24, 12 + beatBurst * 10);
  rect(cx - unit * 5, baseY - unit * 21, unit * 10, unit * 2, "#020306", 0.96);
  rect(cx - unit * 3.2, baseY - unit * 18, unit * 6.4, unit * 5.4, palette[3] || "#ffd166", 0.96);
  rect(cx - unit * 4.4, baseY - unit * 12, unit * 8.8, unit * 13, palette[0] || "#45f5a1", 0.9);
  drawLine(cx - unit * 4, baseY - unit * 10, cx - unit * (10 + beatBurst * 3), baseY - unit * (13 + energy * 4), palette[1] || "#4fd8ff", 0.88, unit * 1.1);
  drawLine(cx + unit * 4, baseY - unit * 10, cx + unit * (10 + beatBurst * 3), baseY - unit * (8 + energy * 4), palette[2] || "#ff5d9d", 0.88, unit * 1.1);
  drawLine(cx - unit * 2, baseY, cx - unit * (7 + beatBurst * 2), baseY + unit * 11, "#f4f7fb", 0.92, unit * 1.25);
  drawLine(cx + unit * 2, baseY, cx + unit * (7 + beatBurst * 2), baseY + unit * 11, "#f4f7fb", 0.92, unit * 1.25);
  rect(w * 0.17, h * 0.78, w * 0.66, 7 + energy * 12, palette[1] || "#4fd8ff", 0.42 + beatBurst * 0.24);
}

function drawSceneClip(clip, w, h, time, seed, palette, energy, beatBurst, intensity) {
  // clip.parts is a small normalized pixel DSL: rect/line/poly only.
  // Coordinates are 0..1 of the canvas, colors are palette tokens or hex, and motion is bound to energy/beatBurst/time.
  const safeClip = sanitizeSceneClip(clip, genericSceneClip(seed, 0, energy));
  let drawn = 0;
  safeClip.parts.forEach((part, index) => {
    try {
      if (drawClipPart(part, w, h, time, seed, palette, energy, beatBurst, intensity, index)) drawn += 1;
    } catch (error) {
      state.lastVisualRenderError = error?.message || String(error);
    }
  });
  if (!drawn) {
    drawEmergencyPixelSubject(w, h, time, seed, palette, energy, beatBurst, safeClip.subject || state.currentTitle);
  }
  if (beatBurst > 0.26 || energy > 0.9) {
    rect(0, 0, w, h, resolveClipColor("light", palette, seed), beatBurst * 0.035 + Math.max(0, energy - 0.9) * 0.08);
  }
}

function keyVisualText(segment) {
  const visual = segment?.keyVisual || {};
  return [
    visual.subject,
    visual.setting,
    Array.isArray(visual.symbols) ? visual.symbols.join(" ") : "",
    visual.foreground,
    visual.midground,
    visual.background,
    visual.styleNotes,
    segment?.themeFamily,
    segment?.primaryMotif,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function textHasAny(text, words) {
  return words.some((word) => text.includes(word));
}

function drawReactiveVjBackground(w, h, time, profile, segment, palette, energy, beatBurst, seed, rhythm = {}) {
  const roles = profile.paletteRoles || normalizePaletteRoles(null, palette);
  const brightness = normalizeBrightness(profile.brightness);
  const sectionLabel = String(rhythm.section?.label || "").toLowerCase();
  const chorusLift = /chorus|hook|drop|peak/.test(sectionLabel) ? brightness.chorusBoost : 0;
  const barHit = clamp(Number(rhythm.bar) || 0, 0, 1);
  const onsetHit = clamp(Number(rhythm.onset) || 0, 0, 1);
  const hit = clamp(energy * 0.48 + beatBurst * 0.72 + barHit * 0.38 + onsetHit * 0.26 + chorusLift, 0, 1.65);
  const push = Math.round(barHit * 3 + beatBurst * 2);
  const background = roles.background || "#111a3f";
  rect(0, 0, w, h, background, 1);
  rect(0, 0, w, h, palette[1] || roles.accent, brightness.backgroundLift * 0.18 + hit * 0.04);
  rect(0, 0, w, h * 0.56, palette[0] || roles.key, 0.04 + hit * 0.045);

  for (let y = 4 - push; y < 238; y += 4) {
    stageRect(w, h, 0, y, 320, 1, y % 16 === 0 ? roles.flash : palette[(y / 4) % palette.length], 0.012 + hit * 0.016);
  }

  const left = segment?.lighting?.colors?.key || roles.key || palette[0];
  const right = segment?.lighting?.colors?.accent || roles.accent || palette[1];
  stagePoly(w, h, [[18, 0], [56, 0], [114 + push, 138], [76, 147]], left, 0.11 + hit * 0.13);
  stagePoly(w, h, [[264, 0], [306, 0], [216 - push, 147], [184, 138]], right, 0.11 + hit * 0.13);
  stagePoly(w, h, [[0, 130 + push], [320, 130 + push], [320, 240], [0, 240]], "#050814", 0.64);

  const floor = segment?.lighting?.colors?.floor || roles.floor || palette[2];
  for (let row = 0; row < 4; row += 1) {
    const y = 148 + row * 19 + push;
    const alpha = 0.22 + row * 0.03 + hit * 0.11;
    for (let x = -20 + (row % 2) * 18; x < 340; x += 44) {
      const color = palette[(row + Math.floor(x / 44) + seed) % palette.length] || floor;
      stagePoly(w, h, [[x, y], [x + 34, y - 6], [x + 52, y + 9], [x + 12, y + 16]], color, alpha);
    }
  }
  stagePoly(w, h, [[58, 150 + push], [262, 150 + push], [300, 205], [20, 205]], floor, 0.09 + hit * 0.1);
}

function drawVjPerformer(w, h, terms, palette, seed, energy, beatBurst) {
  const cx = 160 + Math.sin(seed) * 8;
  const pulse = 1 + beatBurst * 0.045 + energy * 0.025;
  const hat = textHasAny(terms, ["hat", "cap", "fedora", "crown"]);
  const jacket = textHasAny(terms, ["jacket", "suit", "coat", "uniform"]);
  stageRect(w, h, cx - 34, 54, 68, 7, "#020306", 0.72);
  if (hat) stageRect(w, h, cx - 22, 42, 44, 10, "#020306", 0.95);
  stageRect(w, h, cx - 14 * pulse, 60, 28 * pulse, 26, "#ffd1a3", 0.98);
  stageRect(w, h, cx - 20 * pulse, 88, 40 * pulse, 58, jacket ? palette[2] || "#ff5d9d" : palette[0] || "#45f5a1", 0.93);
  stageRect(w, h, cx - 7, 91, 14, 55, "#f4f7fb", 0.8);
  stageLine(w, h, cx - 20, 98, cx - 62 - beatBurst * 7, 116 - energy * 8, palette[1] || "#4fd8ff", 0.9, 5);
  stageLine(w, h, cx + 20, 98, cx + 62 + beatBurst * 8, 110 - energy * 6, palette[3] || "#ffd166", 0.9, 5);
  stageLine(w, h, cx + 66, 104, cx + 66, 151, "#f4f7fb", 0.72, 3);
  stageRect(w, h, cx + 60, 102, 14, 7, palette[1] || "#4fd8ff", 0.9);
  stageLine(w, h, cx - 8, 144, cx - 31, 195 + beatBurst * 4, "#f4f7fb", 0.9, 6);
  stageLine(w, h, cx + 8, 144, cx + 31, 195 - beatBurst * 4, "#f4f7fb", 0.9, 6);
  stageRect(w, h, cx - 50, 204, 100, 7, palette[1] || "#4fd8ff", 0.22 + beatBurst * 0.14);
}

function drawVjHeart(w, h, palette, energy, beatBurst) {
  const hit = 1 + beatBurst * 0.08 + energy * 0.04;
  const cx = 160;
  const cy = 104;
  const color = palette[2] || "#ff5d9d";
  stagePixelDisk(w, h, cx - 28 * hit, cy - 10, 28 * hit, color, 0.94, 3);
  stagePixelDisk(w, h, cx + 28 * hit, cy - 10, 28 * hit, color, 0.94, 3);
  stagePoly(w, h, [[cx - 64 * hit, cy], [cx + 64 * hit, cy], [cx, cy + 75 * hit]], color, 0.96);
  stagePixelDisk(w, h, cx, cy + 8, 18 * hit, palette[3] || "#ffd166", 0.24 + beatBurst * 0.16, 4);
  stageRect(w, h, cx - 82, cy + 92, 164, 7, palette[1] || "#4fd8ff", 0.18 + beatBurst * 0.16);
}

function drawVjWindowRain(w, h, palette, energy, beatBurst, seed, time) {
  stageRect(w, h, 88, 42, 144, 106, "#091126", 0.94);
  stageRect(w, h, 96, 50, 60, 90, palette[1] || "#4fd8ff", 0.13 + beatBurst * 0.08);
  stageRect(w, h, 164, 50, 60, 90, palette[0] || "#45f5a1", 0.11 + energy * 0.08);
  stageLine(w, h, 160, 42, 160, 148, "#f4f7fb", 0.28, 3);
  stageLine(w, h, 88, 95, 232, 95, "#f4f7fb", 0.22, 3);
  stagePixelDisk(w, h, 206, 68, 19, palette[3] || "#ffd166", 0.72 + beatBurst * 0.14, 3);
  for (let index = 0; index < 20; index += 1) {
    const x = 80 + seeded(seed + 21, index) * 160;
    const y = 34 + ((timeSeed(seed, index) + index * 17 + time * 45 + energy * 24) % 110);
    stageLine(w, h, x, y, x - 8, y + 18, palette[1] || "#4fd8ff", 0.2 + beatBurst * 0.08, 1);
  }
  stageRect(w, h, 66, 160, 188, 8, palette[2] || "#ff5d9d", 0.18 + beatBurst * 0.14);
}

function timeSeed(seed, index) {
  return Math.floor(seeded(seed, index) * 997);
}

function drawVjStreet(w, h, palette, seed, energy, beatBurst) {
  for (let index = 0; index < 10; index += 1) {
    const bw = 15 + seeded(seed + 4, index) * 22;
    const bh = 28 + seeded(seed + 8, index) * 70;
    const x = index * 34 - 12;
    stageRect(w, h, x, 128 - bh, bw, bh, "#050814", 0.82);
    for (let y = 132 - bh; y < 122; y += 15) {
      if (seeded(seed + y, index) > 0.48) stageRect(w, h, x + 4, y, 4, 5, palette[3] || "#ffd166", 0.36 + beatBurst * 0.12);
    }
  }
  stagePoly(w, h, [[112, 128], [208, 128], [278, 218], [42, 218]], "#05070b", 0.72);
  stageLine(w, h, 160, 130, 160, 218, palette[3] || "#ffd166", 0.24 + beatBurst * 0.2, 3);
  stageRect(w, h, 62, 112, 10, 60, palette[1] || "#4fd8ff", 0.5 + energy * 0.16);
  stagePixelDisk(w, h, 67, 104, 13, palette[1] || "#4fd8ff", 0.48 + beatBurst * 0.2, 3);
}

function drawVjRecord(w, h, palette, energy, beatBurst) {
  const cx = 156;
  const cy = 115;
  const radius = 58 + beatBurst * 5;
  stagePixelDisk(w, h, cx, cy, radius, "#05070b", 0.96, 3);
  stagePixelDisk(w, h, cx, cy, radius * 0.72, palette[1] || "#4fd8ff", 0.18 + energy * 0.06, 4);
  stagePixelDisk(w, h, cx, cy, 18 + beatBurst * 2, palette[3] || "#ffd166", 0.92, 3);
  stageLine(w, h, 226, 68, 196 - beatBurst * 4, 116, palette[2] || "#ff5d9d", 0.76, 5);
  stageRect(w, h, 82, 184, 164, 8, palette[0] || "#45f5a1", 0.18 + beatBurst * 0.18);
}

function drawVjPlanet(w, h, palette, seed, energy, beatBurst) {
  const cx = 160;
  const cy = 102;
  stagePixelDisk(w, h, cx, cy, 44 + beatBurst * 4, palette[1] || "#4fd8ff", 0.9, 3);
  stagePoly(w, h, [[82, 111], [238, 82], [246, 96], [91, 126]], palette[3] || "#ffd166", 0.52 + beatBurst * 0.16);
  stagePixelDisk(w, h, cx - 12, cy - 10, 12, palette[0] || "#45f5a1", 0.28 + energy * 0.1, 3);
  for (let index = 0; index < 18; index += 1) {
    const x = 32 + seeded(seed + 77, index) * 256;
    const y = 30 + seeded(seed + 91, index) * 120;
    drawPixelSpark(w, h, x, y, 2 + seeded(seed, index) * 3, palette[index % palette.length], 0.32 + beatBurst * 0.22);
  }
}

function drawVjCamera(w, h, palette, energy, beatBurst) {
  stageRect(w, h, 88, 68, 142, 92, palette[0] || "#45f5a1", 0.9);
  stageRect(w, h, 108, 54, 58, 18, palette[2] || "#ff5d9d", 0.86);
  stagePixelDisk(w, h, 160, 114, 35 + beatBurst * 4, "#05070b", 0.88, 3);
  stagePixelDisk(w, h, 160, 114, 18 + energy * 5, palette[1] || "#4fd8ff", 0.74 + beatBurst * 0.18, 3);
  stageRect(w, h, 196, 82, 18, 10, palette[3] || "#ffd166", 0.9);
}

function drawVjHorror(w, h, palette, seed, energy, beatBurst) {
  stagePixelDisk(w, h, 226, 62, 28, palette[3] || "#ffd166", 0.72 + beatBurst * 0.12, 3);
  stageRect(w, h, 82, 80, 58, 78, "#05070b", 0.94);
  stageRect(w, h, 96, 96, 12, 8, palette[2] || "#ff5d9d", 0.78 + beatBurst * 0.22);
  stageRect(w, h, 116, 96, 12, 8, palette[2] || "#ff5d9d", 0.78 + beatBurst * 0.22);
  stageLine(w, h, 132, 152, 164 + beatBurst * 8, 174 - energy * 6, "#f4f7fb", 0.78, 5);
  stageLine(w, h, 170, 156, 198 + beatBurst * 6, 140, palette[1] || "#4fd8ff", 0.5, 4);
}

function drawVjFlower(w, h, palette, energy, beatBurst) {
  const cx = 160;
  const cy = 92;
  for (let index = 0; index < 6; index += 1) {
    const angle = (Math.PI * 2 * index) / 6;
    stagePixelDisk(w, h, cx + Math.cos(angle) * (24 + beatBurst * 4), cy + Math.sin(angle) * (20 + beatBurst * 3), 18, palette[2] || "#ff5d9d", 0.82, 3);
  }
  stagePixelDisk(w, h, cx, cy, 16, palette[3] || "#ffd166", 0.9, 3);
  stageLine(w, h, cx, cy + 18, cx - 8, 178, palette[0] || "#45f5a1", 0.78, 5);
  stagePoly(w, h, [[cx - 12, 135], [cx - 54, 122], [cx - 18, 150]], palette[0] || "#45f5a1", 0.64);
  stagePoly(w, h, [[cx - 6, 148], [cx + 48, 134], [cx + 14, 164]], palette[1] || "#4fd8ff", 0.52);
}

function drawStaticKeyVisual(w, h, segment, palette, seed, energy, beatBurst, time = 0) {
  const terms = keyVisualText(segment);
  if (textHasAny(terms, ["ghost", "monster", "zombie", "wolf", "horror", "terror", "grave", "nightmare", "鬼", "狼", "僵尸", "怪物"])) {
    drawVjHorror(w, h, palette, seed, energy, beatBurst);
  } else if (textHasAny(terms, ["heart", "love", "lover", "girl", "baby", "kiss", "rose", "romance", "爱情", "女孩", "心"])) {
    drawVjHeart(w, h, palette, energy, beatBurst);
  } else if (textHasAny(terms, ["rain", "window", "storm", "umbrella", "tears", "room", "bedroom", "雨", "窗", "伞"])) {
    drawVjWindowRain(w, h, palette, energy, beatBurst, seed, time);
  } else if (textHasAny(terms, ["street", "city", "road", "car", "subway", "train", "neon", "downtown", "城市", "街", "车", "路"])) {
    drawVjStreet(w, h, palette, seed, energy, beatBurst);
  } else if (textHasAny(terms, ["record", "vinyl", "disc", "cd", "radio", "speaker", "turntable", "唱片", "碟", "音箱"])) {
    drawVjRecord(w, h, palette, energy, beatBurst);
  } else if (textHasAny(terms, ["planet", "star", "moon", "sky", "world", "space", "dream", "宇宙", "星", "月", "世界"])) {
    drawVjPlanet(w, h, palette, seed, energy, beatBurst);
  } else if (textHasAny(terms, ["camera", "movie", "film", "photo", "scene", "镜头", "电影", "照片"])) {
    drawVjCamera(w, h, palette, energy, beatBurst);
  } else if (textHasAny(terms, ["flower", "rose", "garden", "bloom", "花", "玫瑰"])) {
    drawVjFlower(w, h, palette, energy, beatBurst);
  } else {
    drawVjPerformer(w, h, terms, palette, seed, energy, beatBurst);
  }
}

function drawVjFlashOverlay(w, h, profile, segment, palette, energy, beatBurst, cueFlash = 0) {
  const roles = profile.paletteRoles || normalizePaletteRoles(null, palette);
  const brightness = normalizeBrightness(profile.brightness);
  const flashColor = segment?.lighting?.colors?.flash || roles.flash || "#fff6b0";
  const flash = clamp(beatBurst * brightness.flash * 0.12 + Math.max(0, energy - 0.82) * 0.12 + cueFlash * 0.09, 0, 0.28);
  if (flash > 0.01) rect(0, 0, w, h, flashColor, flash);
  if (beatBurst > 0.24) {
    strokeRect(24, 24, w - 48, h - 82, segment?.lighting?.colors?.key || roles.key || palette[0], 0.08 + beatBurst * 0.14, 3);
  }
}

function drawKeyVisualVjScene(w, h, time, cue, cueIndex, progress, profile, segment, palette, seed, energy, beatBurst, intensity) {
  const rhythm = rhythmStateAt(profile, time);
  const reactiveBeat = Math.max(beatBurst, rhythm.beat * 0.72, rhythm.bar * 1.08, rhythm.onset * 0.82);
  drawReactiveVjBackground(w, h, time, profile, segment, palette, energy, reactiveBeat, seed, rhythm);
  const push = 1 + rhythm.bar * 0.025 + reactiveBeat * 0.018;
  const shake = reactiveBeat > 0.7 ? Math.sin(time * 44 + seed) * 3 * intensity : 0;
  ctx2d.save();
  try {
    ctx2d.translate(w / 2 + shake, h * 0.48);
    ctx2d.scale(push, push);
    ctx2d.translate(-w / 2, -h * 0.48);
    drawStaticKeyVisual(w, h, segment, palette, seed, energy, reactiveBeat, time);
  } finally {
    ctx2d.restore();
  }
  const cueFlash = cue ? Math.max(0, 1 - progress * 5) : 0;
  drawVjFlashOverlay(w, h, profile, segment, palette, energy, reactiveBeat, cueFlash);
  return { palette, energy, scene: "key-visual-v3" };
}

function drawGeneratedScene(w, h, time, cue, cueIndex, progress) {
  const fallbackSeed = hashText(`${state.currentTitle}:emergency`);
  try {
    const profile = visualProfile();
    const segment = sceneAt(time, profile) || {};
    const visual = segment.visual || {};
    const themeSeed = Number(visual.seed || profile.visualDNA?.seed || hashText(`${state.currentTitle}:${profile.themeLabel}:${Math.floor(segment.start || 0)}`)) >>> 0;
    const cueSeed = hashText(`${cue?.text || "idle"}:${cueIndex}`);
    const basePalette = Array.isArray(profile.palette) && profile.palette.length ? profile.palette : paletteFor(themeSeed);
    const intentPalette = Array.isArray(segment.intent?.palette)
      ? segment.intent.palette.filter((color) => /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(String(color || ""))).slice(0, 6)
      : [];
    const palette = intentPalette.length >= 3 ? intentPalette : basePalette;
    const intensity = Number(motionIntensity?.value || 1);
    const rhythm = rhythmStateAt(profile, time);
    const energy = clamp(visualEnergy(time, cue, themeSeed, profile) * intensity * Number(segment.density || 1), 0, 1);
    const burst = Math.max(waveformPeakPulse(profile, time), rhythm.beat * 0.65, rhythm.bar * 0.92, rhythm.onset * 0.72);

    drawScreenBase(w, h, time, palette, energy, intensity);
    if (segment.kind === "key-visual" || segment.keyVisual) {
      return drawKeyVisualVjScene(w, h, time, cue, cueIndex, progress, profile, segment, palette, themeSeed, energy, burst, intensity);
    }
    if (drawPixelSpriteScene(segment.clip, w, h, time, themeSeed, profile, segment, palette, energy, burst, intensity)) {
      const cueFlash = cue ? Math.max(0, 1 - progress * 5) : 0;
      if (cueFlash > 0) {
        rect(0, 0, w, h, palette[cueSeed % palette.length], cueFlash * 0.035);
      }
      return { palette, energy, scene: "pixel-sprite-script" };
    }
    drawStageVignette(w, h, palette, energy, burst);
    drawSceneClip(segment.clip, w, h, time, themeSeed, palette, energy, burst, intensity);
    const cueFlash = cue ? Math.max(0, 1 - progress * 5) : 0;
    if (cueFlash > 0) {
      rect(0, 0, w, h, palette[cueSeed % palette.length], cueFlash * 0.045);
      strokeRect(28, 28, w - 56, h - 110, palette[(cueSeed + 1) % palette.length], cueFlash * 0.18, 3);
    }
    return { palette, energy, scene: "clip-dsl" };
  } catch (error) {
    state.lastVisualRenderError = error?.message || String(error);
    const palette = paletteFor(fallbackSeed);
    drawScreenBase(w, h, time, palette, 0.75, 1);
    drawStageVignette(w, h, palette, 0.75, 0.4);
    drawEmergencyPixelSubject(w, h, time, fallbackSeed, palette, 0.75, 0.4, state.currentTitle);
    return { palette, energy: 0.75, scene: "emergency" };
  }
}

function splitLyricLines(text) {
  const clean = String(text || "").trim();
  if (!clean) return [];
  if (clean.length <= 16) return [clean];
  const target = Math.ceil(clean.length / 2);
  const breakChars = ["，", "。", "、", " ", "/", "|", "-", "："];
  let best = -1;
  breakChars.forEach((char) => {
    const left = clean.lastIndexOf(char, target);
    const right = clean.indexOf(char, target);
    [left, right].forEach((candidate) => {
      if (candidate > 3 && candidate < clean.length - 3) {
        if (best < 0 || Math.abs(candidate - target) < Math.abs(best - target)) best = candidate;
      }
    });
  });
  if (best < 0) best = target;
  return [clean.slice(0, best + 1).trim(), clean.slice(best + 1).trim()].filter(Boolean);
}

function drawClippedLyricText(line, x, y, size, color, clipLeft, clipWidth) {
  ctx2d.save();
  ctx2d.beginPath();
  ctx2d.rect(clipLeft, y - size * 0.72, clipWidth, size * 1.45);
  ctx2d.clip();
  pixelTextClean(line, x, y, size, color);
  ctx2d.restore();
}

function drawLyricLineByStyle(line, x, y, size, style, progress, visual, seed, index) {
  const palette = visual.palette || ["#45f5a1", "#4fd8ff", "#ff5d9d", "#ffd166"];
  const energy = visual.energy || 0;
  const reveal = clamp(progress * 1.08 - index * 0.08, 0, 1);
  const jitter = style === "glitch" ? Math.max(0, 1 - progress * 7) * (4 + energy * 9) : 0;
  const bounce = style === "neon" ? Math.sin(progress * Math.PI) * (5 + energy * 8) : 0;
  const lineY = y - bounce + (style === "poster" ? Math.sin(seed + index) * energy * 2 : 0);

  if (style === "karaoke") {
    ctx2d.font = `900 ${size}px Consolas, "Microsoft YaHei", monospace`;
    const width = ctx2d.measureText(line).width + size * 0.45;
    pixelTextClean(line, x, lineY, size, "rgba(244,247,251,0.48)");
    drawClippedLyricText(line, x, lineY, size, palette[0] || "#45f5a1", x - width / 2, width * reveal);
    rect(x - width / 2 + width * reveal, lineY - size * 0.62, 3 + energy * 7, size * 1.18, palette[1] || "#4fd8ff", 0.22 + energy * 0.24);
    return;
  }

  if (style === "glitch") {
    pixelText(line, x + jitter, lineY, size, palette[2] || "#ff5d9d");
    pixelText(line, x - jitter * 0.7, lineY + jitter * 0.35, size, palette[1] || "#4fd8ff");
    pixelTextClean(line, x, lineY, size, "#f4f7fb");
    return;
  }

  if (style === "poster") {
    const block = size * 0.18;
    ctx2d.font = `900 ${size}px Consolas, "Microsoft YaHei", monospace`;
    const width = ctx2d.measureText(line).width;
    rect(x - width / 2 - 14, lineY - size * 0.76, width + 28, size * 1.28, palette[(index + 2) % palette.length], 0.12 + energy * 0.13);
    rect(x - width / 2 - 14, lineY + size * 0.58, width * reveal + 28, block + energy * 5, palette[0] || "#45f5a1", 0.58);
    pixelText(line.toUpperCase(), x, lineY, size, "#f4f7fb");
    return;
  }

  const pulse = 1 + Math.sin(progress * Math.PI) * 0.08 + energy * 0.04;
  const neonSize = size * pulse;
  pixelText(line, x + Math.sin(seed + index) * 2, lineY, neonSize, palette[1] || "#4fd8ff");
  pixelTextClean(line, x, lineY, neonSize, "#f4f7fb");
  rect(x - Math.min(280, line.length * size * 0.32), lineY + size * 0.76, Math.min(560, line.length * size * 0.64) * reveal, 4 + energy * 5, palette[2] || "#ff5d9d", 0.5);
}

function drawLyricStage(w, h, time, cue, visual) {
  if (!cue?.text) return;
  const text = cue.text;
  const lines = splitLyricLines(text);
  if (!lines.length) return;
  const style = lyricStyle.value || "karaoke";
  const progress = cueProgress(cue, time);
  const maxLength = Math.max(...lines.map((line) => line.length), 1);
  const baseSize = Math.max(24, Math.min(style === "poster" ? 48 : 42, Math.floor((w * 0.84) / Math.max(9, maxLength * 0.9))));
  const stageHeight = Math.max(82, lines.length * baseSize * 1.08 + 36);
  const top = h - stageHeight - 18;
  const left = w * 0.075;
  const width = w * 0.85;
  const palette = visual.palette || ["#45f5a1", "#4fd8ff", "#ff5d9d", "#ffd166"];
  const entry = Math.max(0, 1 - progress * 7);
  const seed = hashText(`${text}:${style}`);

  if (style === "poster") {
    rect(left, top, width, stageHeight, "#05070b", 0.56 + visual.energy * 0.16);
    rect(left, top, width, 7 + entry * 8, palette[0], 0.7);
  } else if (style === "glitch") {
    rect(left + Math.sin(time * 18) * entry * 8, top, width, stageHeight, "#020306", 0.58 + entry * 0.16);
    strokeRect(left, top, width, stageHeight, palette[2] || "#ff5d9d", 0.12 + entry * 0.28, 2);
  } else if (style === "neon") {
    rect(left, top, width, stageHeight, "#020306", 0.36);
    strokeRect(left, top, width, stageHeight, palette[1] || "#4fd8ff", 0.28 + visual.energy * 0.14, 3);
  } else {
    rect(left, top, width, stageHeight, "#020306", 0.72);
    rect(left, top, width, 4, palette[0], 0.68 + visual.energy * 0.2);
    strokeRect(left, top, width, stageHeight, palette[1] || palette[0], 0.18 + visual.energy * 0.1, 2);
  }

  lines.forEach((line, index) => {
    const y = top + 34 + index * baseSize * 1.02;
    drawLyricLineByStyle(line, w / 2, y, baseSize, style, progress, visual, seed, index);
  });

}

function drawPixelScreen() {
  try {
    const w = pixelScreen.width;
    const h = pixelScreen.height;
    const t = visualTime();
    const cue = cueAt(t);
    const cueIndex = cueIndexAt(t);
    const progress = cueProgress(cue, t);
    const visual = drawGeneratedScene(w, h, t, cue, cueIndex, progress);

    pixelText("PIXEL OK", 34, 34, 18, "#45f5a1", "left");
    pixelText(state.currentTitle.toUpperCase(), w - 34, 34, 16, "#ffd166", "right");

    drawLyricStage(w, h, t, cue, visual);

    const duration = Number(backingAudio.duration || leadAudio.duration || acapellaAudio.duration || songAudio.duration || 0);
    if (duration > 0) {
      const pct = Math.max(0, Math.min(1, t / duration));
      rect(34, 60, w - 68, 5, "#ffffff", 0.08);
      rect(34, 60, (w - 68) * pct, 5, visual.palette[0], 0.82);
    }

    mirrorPixelScreenToFront();
  } catch (error) {
    state.lastVisualRenderError = error?.message || String(error);
    const w = pixelScreen.width || 960;
    const h = pixelScreen.height || 720;
    drawScreenBase(w, h, 0, ["#ff315a", "#4fd8ff", "#ffd166", "#45f5a1"], 0.65, 1);
    drawEmergencyPixelSubject(w, h, 0, hashText("render-error"), ["#ff315a", "#4fd8ff", "#ffd166", "#45f5a1"], 0.8, 0.5, "RENDER ERROR");
    mirrorPixelScreenToFront();
  } finally {
    requestAnimationFrame(drawPixelScreen);
  }
}

async function togglePixelPreview() {
  if (state.visualPreview) {
    if (state.visualPreview.mode === "stem") {
      pauseActiveStem();
      return;
    }
    state.visualPreview = null;
    previewMvButton.classList.remove("active");
    previewMvButton.textContent = "预览像素屏";
    updatePipelineStatus();
    return;
  }
  previewMvButton.disabled = true;
  try {
    await ensureAnimationReady();
    state.visualPreview = { startedAt: performance.now() };
    previewMvButton.classList.add("active");
    previewMvButton.textContent = "停止像素屏";
    setStatus(mvStatus, `${planSourceLabel()} 已准备好，正在预览像素屏。`);
  } catch (error) {
    setStatus(mvStatus, error.message || "预览前需要先准备歌词时间轴和动画分镜。");
  } finally {
    previewMvButton.disabled = false;
    updatePipelineStatus();
  }
}

async function getAudioCtx() {
  if (!state.audioCtx) {
    state.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (state.audioCtx.state === "suspended") {
    await state.audioCtx.resume();
  }
  return state.audioCtx;
}

async function decodeUrl(url) {
  const ctx = await getAudioCtx();
  const response = await fetch(url);
  const buffer = await response.arrayBuffer();
  return ctx.decodeAudioData(buffer.slice(0));
}

async function decodeBlob(blob) {
  const ctx = await getAudioCtx();
  const buffer = await blob.arrayBuffer();
  return ctx.decodeAudioData(buffer.slice(0));
}

function alignmentReferenceUrl() {
  if (state.leadUrl) return { url: state.leadUrl, label: "主唱" };
  if (state.acapellaUrl) return { url: state.acapellaUrl, label: "全人声" };
  return { url: "", label: "" };
}

function envelopeFromBuffer(buffer, stepSeconds = 0.025) {
  const sampleRate = buffer.sampleRate;
  const hop = Math.max(128, Math.round(sampleRate * stepSeconds));
  const frame = Math.max(hop, Math.round(sampleRate * 0.055));
  const length = Math.max(1, Math.ceil(buffer.length / hop));
  const raw = new Float32Array(length);
  const channelCount = Math.min(buffer.numberOfChannels || 1, 2);
  const channels = Array.from({ length: channelCount }, (_, index) => buffer.getChannelData(index));

  for (let index = 0; index < length; index += 1) {
    const start = index * hop;
    const end = Math.min(buffer.length, start + frame);
    let sum = 0;
    let count = 0;
    for (let cursor = start; cursor < end; cursor += 1) {
      let sample = 0;
      for (let channel = 0; channel < channelCount; channel += 1) {
        sample += channels[channel][cursor] || 0;
      }
      sample /= channelCount;
      sum += sample * sample;
      count += 1;
    }
    raw[index] = Math.sqrt(sum / Math.max(1, count));
  }

  const onset = new Float32Array(length);
  let previous = 0;
  for (let index = 0; index < length; index += 1) {
    const value = Math.log1p(raw[index] * 22);
    onset[index] = Math.max(0, value - previous * 0.82) + value * 0.22;
    previous = value;
  }

  const sorted = Array.from(onset).sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length * 0.5)] || 0;
  const high = sorted[Math.floor(sorted.length * 0.88)] || 0;
  const scale = Math.max(high - median, 1e-5);
  const values = new Float32Array(length);
  for (let index = 0; index < length; index += 1) {
    values[index] = clamp((onset[index] - median) / scale, 0, 1.8);
  }
  return { values, stepSeconds, duration: buffer.duration };
}

function firstActiveEnvelopeTime(envelope, threshold = 0.28) {
  if (!envelope?.values?.length) return 0;
  const values = envelope.values;
  let run = 0;
  for (let index = 0; index < values.length; index += 1) {
    run = values[index] >= threshold ? run + 1 : 0;
    if (run >= 3) return Math.max(0, (index - 2) * envelope.stepSeconds);
  }
  return 0;
}

function correlationForLag(reference, vocal, lagFrames) {
  const ref = reference.values;
  const dry = vocal.values;
  const refStart = Math.max(0, lagFrames);
  const dryStart = Math.max(0, -lagFrames);
  const count = Math.min(ref.length - refStart, dry.length - dryStart);
  if (count < 20) return -Infinity;

  let sum = 0;
  let refEnergy = 0;
  let dryEnergy = 0;
  let active = 0;
  for (let index = 0; index < count; index += 1) {
    const a = ref[refStart + index];
    const b = dry[dryStart + index];
    sum += a * b;
    refEnergy += a * a;
    dryEnergy += b * b;
    if (a > 0.25 || b > 0.25) active += 1;
  }
  if (active < 10 || refEnergy < 1e-4 || dryEnergy < 1e-4) return -Infinity;
  return sum / Math.sqrt(refEnergy * dryEnergy);
}

function bestAlignmentOffset(reference, vocal, searchSeconds = 30, centerOffset = 0) {
  const step = reference.stepSeconds;
  const maxLag = Math.max(1, Math.round(searchSeconds / step));
  const centerLag = Math.round((Number(centerOffset) || 0) / step);
  let bestLag = centerLag;
  let bestScore = -Infinity;
  for (let lag = centerLag - maxLag; lag <= centerLag + maxLag; lag += 1) {
    const score = correlationForLag(reference, vocal, lag);
    if (score > bestScore) {
      bestScore = score;
      bestLag = lag;
    }
  }

  if (!Number.isFinite(bestScore) || bestScore < 0.12) {
    const onsetFallback = firstActiveEnvelopeTime(reference) - firstActiveEnvelopeTime(vocal);
    const fallback = Number.isFinite(onsetFallback) && Math.abs(onsetFallback - centerOffset) <= searchSeconds
      ? onsetFallback
      : centerOffset;
    return {
      offset: clamp(fallback, Number(vocalOffset.min) || -30, Number(vocalOffset.max) || 30),
      score: Math.max(0, Number.isFinite(bestScore) ? bestScore : 0),
      method: "first-onset",
    };
  }

  return {
    offset: clamp(bestLag * step, Number(vocalOffset.min) || -30, Number(vocalOffset.max) || 30),
    score: bestScore,
    method: "correlation",
  };
}

function offsetDirectionText(offset) {
  const amount = Math.abs(Number(offset) || 0);
  if (amount < 0.015) return "基本不用移动干声。";
  if (offset < 0) return `系统把干声提前 ${amount.toFixed(2)}s；也就是你现在听起来偏晚。`;
  return `系统把干声延后 ${amount.toFixed(2)}s；也就是你现在听起来偏早。`;
}

function firstLyricStart() {
  if (!Array.isArray(state.lyricCues) || !state.lyricCues.length) return null;
  const first = state.lyricCues.find((cue) => Number.isFinite(Number(cue.start)) && Number(cue.end) > Number(cue.start));
  return first ? Math.max(0, Number(first.start) || 0) : null;
}

function skipIntroStartTime() {
  const firstStart = firstLyricStart();
  if (!Number.isFinite(firstStart)) return null;
  return Math.max(0, firstStart - 5);
}

function updateRecordControls() {
  const canRecord = Boolean(state.backingUrl && state.capabilities.recorder);
  const recording = isRecording();
  recordButton.disabled = recording || !canRecord;
  if (skipIntroRecordButton) {
    skipIntroRecordButton.disabled = recording || !canRecord || !Number.isFinite(skipIntroStartTime());
  }
  if (pixelRecordButton) {
    const ready = pixelReadyForRecording();
    pixelRecordButton.disabled = !recording && (!ready || !state.capabilities.recorder);
  }
}

function envelopeAt(envelope, time) {
  if (!envelope || !Number.isFinite(time) || time < 0 || time > envelope.duration) return 0;
  const index = Math.floor(time / envelope.stepSeconds);
  return envelope.values[Math.max(0, Math.min(envelope.values.length - 1, index))] || 0;
}

function drawWaveLayer(ctx, envelope, duration, color, options = {}) {
  if (!envelope?.values?.length) return;
  const width = alignmentWaveform.width;
  const height = alignmentWaveform.height;
  const center = options.center ?? height * 0.5;
  const polarity = options.polarity ?? -1;
  const gain = options.gain ?? height * 0.34;
  const offset = options.offset ?? 0;
  const points = [];
  for (let x = 0; x < width; x += 1) {
    const time = (x / Math.max(1, width - 1)) * duration;
    const value = Math.min(1.4, envelopeAt(envelope, time - offset));
    const y = center + polarity * value * gain;
    points.push([x, y]);
  }

  ctx.globalAlpha = 0.2;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, center);
  points.forEach(([x, y]) => ctx.lineTo(x, y));
  ctx.lineTo(width, center);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;

  ctx.strokeStyle = color;
  ctx.lineWidth = options.lineWidth || 2;
  ctx.beginPath();
  points.forEach(([x, y], index) => {
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();
}

function drawAlignmentWaveform() {
  if (!alignmentCtx || !alignmentWaveform) return;
  const ctx = alignmentCtx;
  const width = alignmentWaveform.width;
  const height = alignmentWaveform.height;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#071018";
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = "rgba(244,247,251,0.1)";
  ctx.lineWidth = 1;
  for (let x = 0; x <= width; x += Math.max(40, width / 10)) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  ctx.strokeStyle = "rgba(244,247,251,0.22)";
  ctx.beginPath();
  ctx.moveTo(0, height * 0.5);
  ctx.lineTo(width, height * 0.5);
  ctx.stroke();

  const reference = state.alignmentReferenceEnvelope;
  const vocal = state.alignmentVocalEnvelope;
  const offset = Number(vocalOffset.value) || 0;
  const duration = Math.max(
    state.backingBuffer?.duration || backingAudio.duration || 0,
    reference?.duration || 0,
    vocal ? Math.max(0, vocal.duration + Math.max(0, offset)) : 0,
    1,
  );

  if (!reference && !vocal) {
    ctx.fillStyle = "rgba(244,247,251,0.56)";
    ctx.font = "bold 14px Consolas, monospace";
    ctx.fillText("录完后这里会显示主唱参考和你的干声波形", 18, height / 2 + 5);
    return;
  }

  drawWaveLayer(ctx, reference, duration, "#4fd8ff", { center: height * 0.48, polarity: -1, gain: height * 0.34 });
  drawWaveLayer(ctx, vocal, duration, "#ff5d9d", { center: height * 0.52, polarity: 1, gain: height * 0.34, offset });

  const playhead = currentMixPosition();
  const x = clamp(playhead / duration, 0, 1) * width;
  ctx.strokeStyle = "#45f5a1";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, 0);
  ctx.lineTo(x, height);
  ctx.stroke();

  ctx.fillStyle = "#ffd166";
  ctx.font = "bold 12px Consolas, monospace";
  ctx.fillText(`${formatClock(playhead)} / ${formatClock(duration)}`, 12, 18);
  ctx.fillStyle = "#4fd8ff";
  ctx.fillText("REF", 12, 40);
  ctx.fillStyle = "#ff5d9d";
  ctx.fillText("YOU", 54, 40);
}

async function ensureAlignmentEnvelopes() {
  if (!state.recordedBlob && state.savedTakeUrl) {
    const response = await fetch(state.savedTakeUrl);
    if (!response.ok) throw new Error("录音文件读取失败。");
    state.recordedBlob = await response.blob();
  }
  if (!state.recordedBlob) throw new Error("还没有干声。先录一段。");
  const reference = alignmentReferenceUrl();
  if (!reference.url) throw new Error("还没有主唱参考轨。先点一键制作生成三轨。");

  if (!state.alignmentReferenceBuffer || state.alignmentReferenceUrl !== reference.url) {
    state.alignmentReferenceBuffer = await decodeUrl(reference.url);
    state.alignmentReferenceUrl = reference.url;
    state.alignmentReferenceLabel = reference.label;
    state.alignmentReferenceEnvelope = envelopeFromBuffer(state.alignmentReferenceBuffer);
  }

  const vocalKey = `${state.recordedBlob.size}:${state.recordedBlob.type}`;
  if (!state.vocalBuffer || state.vocalBufferKey !== vocalKey) {
    state.vocalBuffer = await decodeBlob(state.recordedBlob);
    state.vocalBufferKey = vocalKey;
  }
  if (!state.alignmentVocalEnvelope || state.alignmentLastResult?.vocalKey !== vocalKey) {
    state.alignmentVocalEnvelope = envelopeFromBuffer(state.vocalBuffer);
  }
  if (state.backingUrl && (!state.backingBuffer || state.backingBufferUrl !== state.backingUrl)) {
    state.backingBuffer = await decodeUrl(state.backingUrl);
    state.backingBufferUrl = state.backingUrl;
  }
  updateMixTransport(state.mixPosition);
}

async function autoAlignRecordedVocal(options = {}) {
  if (!options.silent) setStatus(alignmentStatus, "正在分析主唱参考和你的干声。");
  autoAlignButton.disabled = true;
  try {
    await ensureAlignmentEnvelopes();
    const centerOffset = Number(vocalOffset.value) || 0;
    const result = bestAlignmentOffset(state.alignmentReferenceEnvelope, state.alignmentVocalEnvelope, 30, centerOffset);
    state.alignmentLastResult = {
      ...result,
      vocalKey: state.vocalBufferKey,
      referenceUrl: state.alignmentReferenceUrl,
    };
    vocalOffset.value = result.offset.toFixed(2);
    handleMixControl(vocalOffset);
    const confidence = result.score >= 0.34 ? "较高" : result.score >= 0.2 ? "一般" : "较低";
    setStatus(
      alignmentStatus,
      `已用${state.alignmentReferenceLabel || "参考轨"}粗对齐：${offsetDirectionText(result.offset)} 可信度${confidence}，还可以用 0.01s/0.1s 微调。`,
    );
    setStatus(mixStatus, `自动粗对齐完成：${offsetDirectionText(result.offset)}`);
  } catch (error) {
    setStatus(alignmentStatus, error.message || "自动对齐失败。");
  } finally {
    autoAlignButton.disabled = !(state.recordedBlob || state.savedTakeUrl) || !alignmentReferenceUrl().url;
    drawAlignmentWaveform();
  }
}

async function ensureMixBuffers() {
  if (!state.recordedBlob && state.savedTakeUrl) {
    const response = await fetch(state.savedTakeUrl);
    if (!response.ok) throw new Error("Saved take could not be loaded.");
    state.recordedBlob = await response.blob();
  }
  if (!state.backingUrl) throw new Error("还没有伴奏。先拆分歌曲。");
  if (!state.recordedBlob) throw new Error("还没有录音。先录一段。");
  if (!state.backingBuffer || state.backingBufferUrl !== state.backingUrl) {
    state.backingBuffer = await decodeUrl(state.backingUrl);
    state.backingBufferUrl = state.backingUrl;
  }
  const key = `${state.recordedBlob.size}:${state.recordedBlob.type}`;
  if (!state.vocalBuffer || state.vocalBufferKey !== key) {
    state.vocalBuffer = await decodeBlob(state.recordedBlob);
    state.vocalBufferKey = key;
  }
  updateMixTransport(state.mixPosition);
}

function distortionCurve(amount) {
  const n = 2048;
  const curve = new Float32Array(n);
  const k = amount * 80;
  for (let i = 0; i < n; i += 1) {
    const x = (i * 2) / n - 1;
    curve[i] = ((1 + k) * x) / (1 + k * Math.abs(x));
  }
  return curve;
}

function createMixGraph(destination) {
  const ctx = state.audioCtx;
  const graph = {
    baseTime: ctx.currentTime + 0.08,
    sources: [],
    backingGain: ctx.createGain(),
    vocalGain: ctx.createGain(),
    hp: ctx.createBiquadFilter(),
    shelf: ctx.createBiquadFilter(),
    compressor: ctx.createDynamicsCompressor(),
    shaper: ctx.createWaveShaper(),
    delay: ctx.createDelay(0.5),
    delayGain: ctx.createGain(),
  };

  const backingSource = ctx.createBufferSource();
  backingSource.buffer = state.backingBuffer;
  backingSource.connect(graph.backingGain).connect(destination);
  graph.sources.push(backingSource);

  const vocalSource = ctx.createBufferSource();
  vocalSource.buffer = state.vocalBuffer;
  graph.hp.type = "highpass";
  graph.shelf.type = "highshelf";
  vocalSource
    .connect(graph.hp)
    .connect(graph.shelf)
    .connect(graph.compressor)
    .connect(graph.shaper)
    .connect(graph.vocalGain)
    .connect(destination);
  graph.compressor.connect(graph.delay).connect(graph.delayGain).connect(destination);
  graph.sources.push(vocalSource);

  graph.backingSource = backingSource;
  graph.vocalSource = vocalSource;
  applyMixSettings(graph);
  return graph;
}

function applyMixSettings(graph = state.activeGraph) {
  updateMixLabels();
  updateMixTransport(state.activeGraph ? currentMixPosition() : state.mixPosition);
  scheduleProjectSave();
  if (!graph) return;
  const preset = presets[state.activePreset] || presets.clean;
  const ctx = state.audioCtx;
  const now = ctx.currentTime;
  graph.backingGain.gain.setTargetAtTime(mixBackingEnabled.checked ? Number(backingGain.value) : 0, now, 0.02);
  graph.vocalGain.gain.setTargetAtTime(Number(vocalGain.value), now, 0.02);
  graph.hp.frequency.setTargetAtTime(preset.hp, now, 0.03);
  graph.shelf.frequency.setTargetAtTime(7400, now, 0.03);
  graph.shelf.gain.setTargetAtTime(preset.shelf, now, 0.03);
  graph.compressor.threshold.setTargetAtTime(preset.comp[0], now, 0.03);
  graph.compressor.ratio.setTargetAtTime(preset.comp[1], now, 0.03);
  graph.compressor.attack.setTargetAtTime(0.006, now, 0.03);
  graph.compressor.release.setTargetAtTime(0.18, now, 0.03);
  graph.delay.delayTime.setTargetAtTime(preset.delay, now, 0.03);
  graph.delayGain.gain.setTargetAtTime(preset.delayGain, now, 0.03);
  graph.shaper.curve = distortionCurve(preset.drive);
}

function mixDuration() {
  const offset = Number(vocalOffset.value) || 0;
  const backingDuration = state.backingBuffer?.duration || 0;
  const vocalDuration = state.vocalBuffer?.duration || 0;
  const vocalEnd = offset >= 0 ? offset + vocalDuration : Math.max(0, vocalDuration + offset);
  return Math.max(backingDuration, vocalEnd, 0);
}

function currentMixPosition() {
  if (!state.activeGraph) return state.mixPosition || 0;
  const ctx = state.audioCtx;
  return clamp(
    state.activeGraph.seekPosition + Math.max(0, ctx.currentTime - state.activeGraph.baseTime),
    0,
    state.activeGraph.duration || mixDuration(),
  );
}

function updateMixTransport(position = currentMixPosition()) {
  const duration = mixDuration();
  const safePosition = clamp(position, 0, duration || 0);
  mixSeek.max = String(Math.max(duration, 0));
  if (!state.mixSeeking) mixSeek.value = String(safePosition);
  mixSeek.disabled = duration <= 0;
  mixCurrent.textContent = formatClock(safePosition);
  mixDurationLabel.textContent = formatClock(duration);
  if (autoAlignButton) autoAlignButton.disabled = !(state.recordedBlob || state.savedTakeUrl) || !alignmentReferenceUrl().url;
  drawAlignmentWaveform();
}

function scheduleMixTick() {
  cancelAnimationFrame(state.mixRaf);
  const tick = () => {
    if (!state.activeGraph) {
      updateMixTransport(state.mixPosition);
      return;
    }
    const position = currentMixPosition();
    state.mixPosition = position;
    updateMixTransport(position);
    if (position >= (state.activeGraph.duration || 0) - 0.03) {
      stopMixPreview();
      state.mixPosition = state.activeGraph?.duration || mixDuration();
      updateMixTransport(state.mixPosition);
      return;
    }
    state.mixRaf = requestAnimationFrame(tick);
  };
  state.mixRaf = requestAnimationFrame(tick);
}

function startGraph(graph, position = state.mixPosition || 0) {
  const base = graph.baseTime;
  const offset = Number(vocalOffset.value) || 0;
  const duration = mixDuration();
  const seekPosition = clamp(position, 0, duration);
  graph.seekPosition = seekPosition;
  graph.duration = duration;
  graph.offset = offset;

  if (seekPosition < state.backingBuffer.duration) {
    graph.backingSource.start(base, seekPosition);
  }

  if (offset >= 0) {
    if (seekPosition >= offset) {
      const vocalStart = Math.min(seekPosition - offset, state.vocalBuffer.duration - 0.01);
      graph.vocalSource.start(base, Math.max(0, vocalStart));
    } else {
      graph.vocalSource.start(base + (offset - seekPosition), 0);
    }
  } else {
    const startOffset = Math.max(0, Math.min(seekPosition + Math.abs(offset), state.vocalBuffer.duration - 0.01));
    if (startOffset < state.vocalBuffer.duration) graph.vocalSource.start(base, startOffset);
  }
  graph.backingSource.onended = () => {
    if (state.activeGraph === graph && currentMixPosition() >= duration - 0.05) stopMixPreview();
  };
  graph.vocalSource.onended = () => {
    if (state.activeGraph === graph && currentMixPosition() >= duration - 0.05) stopMixPreview();
  };
  scheduleMixTick();
}

function stopMixPreview(updateText = true) {
  if (!state.activeGraph) return;
  state.mixPosition = currentMixPosition();
  cancelAnimationFrame(state.mixRaf);
  state.activeGraph.sources.forEach((source) => {
    try {
      source.stop();
    } catch {
      // Already stopped.
    }
  });
  state.activeGraph = null;
  playMixButton.classList.remove("active");
  if (updateText) playMixButton.textContent = "播放预览";
  updateMixTransport(state.mixPosition);
  updatePixelFront();
}

async function toggleMixPreview() {
  if (state.activeGraph) {
    stopMixPreview();
    return;
  }
  try {
    await ensureMixBuffers();
    const duration = mixDuration();
    if (state.mixPosition >= duration - 0.03) state.mixPosition = 0;
    updateMixTransport(state.mixPosition);
    state.visualPreview = null;
    const ctx = await getAudioCtx();
    const graph = createMixGraph(ctx.destination);
    state.activeGraph = graph;
    startGraph(graph, state.mixPosition);
    playMixButton.classList.add("active");
    playMixButton.textContent = "停止预览";
    setStatus(mixStatus, "正在预览。切换预设、音量和伴奏开关会立即作用。");
  } catch (error) {
    setStatus(mixStatus, error.message || "无法播放预览");
  }
}

async function seekMixPreview(position, keepPlaying = Boolean(state.activeGraph)) {
  const wasPlaying = Boolean(state.activeGraph);
  if (wasPlaying) stopMixPreview(false);
  state.mixPosition = clamp(Number(position) || 0, 0, mixDuration());
  updateMixTransport(state.mixPosition);
  if (!keepPlaying || !wasPlaying) return;
  try {
    await ensureMixBuffers();
    const graph = createMixGraph(state.audioCtx.destination);
    state.activeGraph = graph;
    startGraph(graph, state.mixPosition);
    playMixButton.classList.add("active");
    playMixButton.textContent = "停止预览";
  } catch (error) {
    setStatus(mixStatus, error.message || "无法跳转预览");
  }
}

function handleMixControl(control) {
  if (control === vocalOffset) {
    vocalOffset.value = clamp(Number(vocalOffset.value) || 0, Number(vocalOffset.min) || -30, Number(vocalOffset.max) || 30).toFixed(2);
    setStatus(alignmentStatus, offsetDirectionText(Number(vocalOffset.value) || 0));
    drawAlignmentWaveform();
  }
  if (control === vocalOffset && state.activeGraph) {
    const position = currentMixPosition();
    applyMixSettings();
    seekMixPreview(position, true);
    return;
  }
  applyMixSettings();
}

async function startRecording(options = {}) {
  if (!state.capabilities.recorder) {
    setStatus(recordStatus, "浏览器不支持录音。");
    return;
  }
  stopMixPreview();
  try {
    const requestedStart = Number(options.timelineStart) || 0;
    const maxStart = Number.isFinite(backingAudio.duration) ? Math.max(0, backingAudio.duration - 0.05) : Number.POSITIVE_INFINITY;
    const timelineStart = clamp(requestedStart, 0, maxStart);
    state.recordTimelineStart = timelineStart;
    state.micStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      },
    });
    const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
      ? "audio/webm;codecs=opus"
      : "";
    state.recordChunks = [];
    state.recorder = new MediaRecorder(state.micStream, mimeType ? { mimeType } : undefined);
    state.recorder.ondataavailable = (event) => {
      if (event.data && event.data.size) state.recordChunks.push(event.data);
    };
    state.recorder.onstop = finishRecording;

    if (monitorBacking.checked && state.backingUrl) {
      backingAudio.pause();
      backingAudio.currentTime = timelineStart;
      await backingAudio.play();
    }
    state.recorder.start(250);
    state.recordStartedAt = performance.now();
    recordClock.textContent = "00:00";
    state.recordTimer = setInterval(() => {
      recordClock.textContent = formatClock((performance.now() - state.recordStartedAt) / 1000);
    }, 200);

    updateRecordControls();
    recordButton.classList.add("recording");
    stopRecordButton.disabled = false;
    redoRecordButton.disabled = true;
    setStatus(
      recordStatus,
      timelineStart > 0
        ? `正在从 ${formatClock(timelineStart)} 录音；保存后会放回整首歌时间线，导出仍从 00:00 开始。`
        : "正在从 00:00 录音；唱完点停止保存。",
    );
  } catch (error) {
    state.micStream?.getTracks().forEach((track) => track.stop());
    state.micStream = null;
    state.recorder = null;
    state.recordTimelineStart = 0;
    backingAudio.pause();
    updateRecordControls();
    setStatus(recordStatus, error.message || "麦克风权限不可用");
  }
}

function stopRecording() {
  if (!state.recorder || state.recorder.state === "inactive") return;
  state.recorder.stop();
  backingAudio.pause();
  clearInterval(state.recordTimer);
  state.recordTimer = null;
  stopRecordButton.disabled = true;
}

function finishRecording() {
  const type = state.recorder?.mimeType || "audio/webm";
  state.recordedBlob = new Blob(state.recordChunks, { type });
  state.savedTakeUrl = "";
  revokeUrl(state.recordedUrl);
  state.recordedUrl = URL.createObjectURL(state.recordedBlob);
  recordedAudio.src = state.recordedUrl;
  downloadTake.href = state.recordedUrl;
  downloadTake.classList.remove("hidden");
  downloadTake.download = `pixel-ok-${Date.now()}-take.webm`;
  state.vocalBuffer = null;
  state.vocalBufferKey = "";
  resetAlignmentCache({ reference: false });
  const timelineStart = clamp(
    Number(state.recordTimelineStart) || 0,
    Number(vocalOffset.min) || -600,
    Number(vocalOffset.max) || 600,
  );
  vocalOffset.value = timelineStart.toFixed(2);
  state.mixPosition = 0;
  updateMixLabels();
  updateMixTransport(0);
  state.micStream?.getTracks().forEach((track) => track.stop());
  state.micStream = null;
  updateRecordControls();
  recordButton.classList.remove("recording");
  redoRecordButton.disabled = false;
  playMixButton.disabled = !state.backingUrl;
  exportMvButton.disabled = !(state.backingUrl && state.capabilities.exporter);
  setStatus(recordStatus, `已保存这段干声，时长 ${recordClock.textContent}；当前放在 ${formatClock(timelineStart)}，导出仍从 00:00 开始。`);
  setStatus(mixStatus, "正在自动估算干声位置。");
  autoAlignRecordedVocal({ silent: true }).catch(() => {});
  uploadTakeToProject()
    .then(() => scheduleProjectSave())
    .catch((error) => setStatus(projectStatus, error.message || "Take save failed."));
}

function redoRecording() {
  stopMixPreview();
  backingAudio.pause();
  revokeUrl(state.recordedUrl);
  state.recordedUrl = "";
  state.recordedBlob = null;
  state.savedTakeUrl = "";
  state.mixPosition = 0;
  state.recordTimelineStart = 0;
  state.vocalBuffer = null;
  state.vocalBufferKey = "";
  resetAlignmentCache({ reference: false });
  clearAudio(recordedAudio);
  downloadTake.classList.add("hidden");
  playMixButton.disabled = true;
  exportMvButton.disabled = true;
  recordClock.textContent = "00:00";
  updateMixTransport(0);
  updateRecordControls();
  redoRecordButton.disabled = true;
  setStatus(recordStatus, "已清掉上一段，可以重录。");
  scheduleProjectSave();
}

function chooseVideoMime() {
  const types = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
  ];
  return types.find((type) => MediaRecorder.isTypeSupported(type)) || "";
}

async function exportMv() {
  if (state.exportSession) return;
  try {
    if (!hasLyricText()) throw new Error("还没有歌词，不能导出歌词动画 MV。");
    await ensureMixBuffers();
    const duration = Math.max(mixDuration(), estimateDuration(), 3);
    await ensureAnimationReady({ duration });
    stopMixPreview();
    state.visualPreview = null;
    previewMvButton.classList.remove("active");
    previewMvButton.textContent = "预览像素屏";
    downloadMv.classList.add("hidden");
    exportMvButton.disabled = true;
    setStatus(mvStatus, "正在实时导出 MV。歌曲多长就大约要等多久。");

    const ctx = await getAudioCtx();
    const audioDest = ctx.createMediaStreamDestination();
    const graph = createMixGraph(audioDest);
    const canvasStream = pixelScreen.captureStream(30);
    const stream = new MediaStream([
      ...canvasStream.getVideoTracks(),
      ...audioDest.stream.getAudioTracks(),
    ]);
    const chunks = [];
    const mimeType = chooseVideoMime();
    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);

    state.exportSession = { startedAt: performance.now(), duration };
    updatePipelineStatus();
    recorder.ondataavailable = (event) => {
      if (event.data && event.data.size) chunks.push(event.data);
    };
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: recorder.mimeType || "video/webm" });
      const url = URL.createObjectURL(blob);
      downloadMv.href = url;
      downloadMv.download = `pixel-ok-${Date.now()}.webm`;
      downloadMv.classList.remove("hidden");
      stream.getTracks().forEach((track) => track.stop());
      state.exportSession = null;
      exportMvButton.disabled = false;
      updatePipelineStatus();
      setStatus(mvStatus, "MV 导出完成，可以下载 WebM。");
    };

    recorder.start(1000);
    startGraph(graph, 0);
    setTimeout(() => {
      graph.sources.forEach((source) => {
        try {
          source.stop();
        } catch {
          // Already stopped.
        }
      });
      if (recorder.state !== "inactive") recorder.stop();
    }, Math.ceil(duration * 1000) + 400);
  } catch (error) {
    state.exportSession = null;
    exportMvButton.disabled = !(state.backingUrl && (state.recordedBlob || state.savedTakeUrl) && state.capabilities.exporter);
    updatePipelineStatus();
    setStatus(mvStatus, error.message || "MV 导出失败");
  }
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitFor(predicate, timeoutMs, label) {
  const started = performance.now();
  while (performance.now() - started < timeoutMs) {
    if (predicate()) return true;
    await wait(900);
  }
  throw new Error(label || "等待超时");
}

function setPixelWorkflow(message, options = {}) {
  state.pixelWorkflowRunning = Boolean(options.running);
  state.pixelWorkflowMessage = message || "";
  state.pixelWorkflowError = options.error || "";
  updatePixelFront();
}

function chooseExistingLyricsPath() {
  if (state.lyricCues.length && hasLyricText()) return "cues";
  if (hasLyricText()) return "text";
  return "";
}

function readLookupFields(file, source = "pixel") {
  const pixelArtist = pixelArtistInput?.value.trim() || "";
  const pixelTitle = pixelTitleInput?.value.trim() || "";
  const studioArtist = lyricArtist?.value.trim() || "";
  const studioTitle = lyricTitle?.value.trim() || "";
  const preferStudio = source === "studio";
  const artist = preferStudio ? studioArtist || pixelArtist : pixelArtist || studioArtist;
  const title = preferStudio ? studioTitle || pixelTitle : pixelTitle || studioTitle;
  return { artist, title, canSearchOfficial: Boolean(title) };
}

function syncPixelLookupToLyrics(file, options = {}) {
  const lookup = options.lookup || readLookupFields(file, options.source || "pixel");
  const artist = lookup.artist || "";
  const title = lookup.title || (!lyricTitle.value.trim() && file ? safeFileStem(file) : lyricTitle.value.trim());
  if (artist) {
    lyricArtist.value = artist;
    if (pixelArtistInput && !pixelArtistInput.value.trim()) pixelArtistInput.value = artist;
  }
  if (title) {
    lyricTitle.value = title;
    if (pixelTitleInput && !pixelTitleInput.value.trim()) pixelTitleInput.value = title;
    state.currentTitle = [artist || lyricArtist.value.trim(), title].filter(Boolean).join(" - ") || title;
  }
  return {
    artist: lyricArtist.value.trim(),
    title: lyricTitle.value.trim(),
    canSearchOfficial: Boolean(lyricTitle.value.trim()),
  };
}

async function runPixelAutoPipeline(file, options = {}) {
  if ((!file && !state.jobId) || state.pixelWorkflowRunning) return;
  const lookupSource = options.lookupSource || "pixel";
  const initialLookup = readLookupFields(file, lookupSource);
  let lookup = syncPixelLookupToLyrics(file, { source: lookupSource, lookup: initialLookup });
  const shouldLoadFile = Boolean(file && (options.resetProject !== false || !state.jobId));
  setPixelWorkflow(shouldLoadFile ? "已收到原歌，正在创建项目。" : "正在接着当前项目一键制作。", { running: true });
  try {
    await loadCapabilities();
    if (shouldLoadFile) {
      loadSongFile(file);
      lookup = syncPixelLookupToLyrics(file, { source: lookupSource, lookup: initialLookup });
      await state.projectCreatePromise?.catch(() => {});
      await waitFor(() => Boolean(state.jobId), 20000, "项目创建还没完成，请切到工程后台查看。");
    } else {
      lookup = syncPixelLookupToLyrics(file, { source: lookupSource, lookup: initialLookup });
    }

    if (!state.backingUrl || !state.leadUrl) {
      if (state.capabilities.uvr) {
        setPixelWorkflow("三轨分离已交给后台；先用原曲继续做歌词和动画。", { running: true });
        try {
          await splitSong();
        } catch (error) {
          setStatus(splitStatus, error.message || "分轨启动失败；动画会先用原曲继续。");
        }
      } else {
        setPixelWorkflow("UVR 暂不可用；先用原曲做歌词和动画，录音伴奏稍后再处理。", { running: true });
      }
    }

    let lyricPath = "";
    let officialError = null;
    if (lookup.canSearchOfficial) {
      setPixelWorkflow("正在按歌手/歌名查官方歌词，并按音频重新对齐。", { running: true });
      try {
        await searchOfficialLyrics({ throwOnError: true });
        lyricPath = chooseExistingLyricsPath();
      } catch (error) {
        officialError = error;
        throw new Error(`官方歌词失败：${error.message || "未知错误"}。已停止，不会用本地识别结果冒充歌词。请检查歌手/歌名后再点一键制作。`);
      }
    }

    if (!lyricPath && !officialError) lyricPath = chooseExistingLyricsPath();
    if (lyricPath === "cues") {
      setPixelWorkflow("已复用现有歌词和字幕时间轴，正在准备动画。", { running: true });
    } else if (lyricPath === "text") {
      setPixelWorkflow("已复用现有歌词，正在生成字幕时间轴。", { running: true });
      await buildLyricCues({ silent: true });
    } else {
      if (!lyricPath && state.leadUrl && state.capabilities.asr) {
        const prefix = "没有填写歌名，改用本地识别。";
        setPixelWorkflow(`${prefix}正在生成字幕。`, { running: true });
        await autoRecognizeLyrics();
        lyricPath = chooseExistingLyricsPath();
      }

      if (!lyricPath) {
        const reason = officialError ? `官方歌词失败：${officialError.message || "未知错误"}。` : "前台没有填写歌名。";
        throw new Error(`${reason}本地歌词识别不可用或没有生成时间轴；请在歌词框校正文字后再点一键制作。`);
      }
    }

    setPixelWorkflow("字幕已准备，正在重新生成这首歌专属动画分镜。", { running: true });
    await buildLyricCues({ silent: true });
    await requestVisualPlan(estimateDuration(), { force: true });

    if (!visualPlanReady() && !state.visualPlan) {
      throw new Error("动画还没有准备好。TODO：切到工程后台查看歌词/分镜状态。");
    }

    if (state.backingUrl) {
      setPixelWorkflow("准备好了。按录音键，电视会跟着伴奏跑动画。", { running: false });
    } else {
      setPixelWorkflow("歌词和动画已准备；三轨还没完成，所以现在可以先预览电视画面，录音要等伴奏出来。", { running: false });
    }
  } catch (error) {
    setPixelWorkflow("", {
      running: false,
      error: error.message || "自动流程暂停，请切到工程后台查看。",
    });
  }
}

function assignPixelFileToBackendInput(file) {
  try {
    const transfer = new DataTransfer();
    transfer.items.add(file);
    songFile.files = transfer.files;
  } catch {
    // Some browsers keep file inputs read-only; state.songFile is the source of truth.
  }
}

function handlePixelSongFile(file) {
  if (!file) return;
  assignPixelFileToBackendInput(file);
  runPixelAutoPipeline(file);
}

function runPixelMakeFromCurrentFile() {
  const file = pixelSongFile?.files?.[0] || state.songFile;
  if (!file) {
    setPixelWorkflow("", { error: "先选择或拖入原歌，再点制作。" });
    return;
  }
  assignPixelFileToBackendInput(file);
  runPixelAutoPipeline(file);
}

function runStudioAutoFromCurrentProject() {
  const file = state.songFile || songFile?.files?.[0] || pixelSongFile?.files?.[0] || null;
  if (!file && !state.jobId) {
    setPixelWorkflow("", { error: "先拖入原歌，再点一键制作。" });
    return;
  }
  if (file) assignPixelFileToBackendInput(file);
  runPixelAutoPipeline(file, { lookupSource: "studio", resetProject: false });
}

async function togglePixelRecord() {
  if (isRecording()) {
    stopRecording();
    updatePixelFront();
    return;
  }
  if (!pixelReadyForRecording()) {
    setPixelWorkflow("", { error: "还没准备好：需要伴奏和动画分镜。" });
    return;
  }
  state.visualPreview = null;
  previewMvButton.classList.remove("active");
  monitorBacking.checked = true;
  const introStart = skipIntroStartTime();
  await startRecording({ timelineStart: Number.isFinite(introStart) ? introStart : 0 });
  updatePixelFront();
}

async function togglePixelPlay() {
  await toggleMixPreview();
  updatePixelFront();
}

function applyTuneMode(modeId) {
  const next = tuneModes.find((mode) => mode.id === modeId) || tuneModes[1];
  state.tuneMode = next.id;
  setPresetButton(next.preset);
  applyMixSettings();
  setPixelWorkflow(`调音风格：${next.label.toLowerCase()}。`, { running: false });
  scheduleProjectSave();
}

function cycleTuneMode() {
  const index = tuneModes.findIndex((mode) => mode.id === state.tuneMode);
  const next = tuneModes[(index + 1 + tuneModes.length) % tuneModes.length];
  applyTuneMode(next.id);
}

function setFrontView(view) {
  const next = view === "studio" ? "studio" : "pixel";
  state.viewMode = next;
  document.body.dataset.view = next;
  showPixelFrontButton?.classList.toggle("active", next === "pixel");
  showStudioBackButton?.classList.toggle("active", next === "studio");
  try {
    localStorage.setItem("pixel-ok-view", next);
  } catch {
    // Storage can be unavailable in private contexts.
  }
}

function wirePixelFrontend() {
  [showPixelFrontButton, showStudioBackButton].forEach((button) => {
    button?.addEventListener("click", () => setFrontView(button.dataset.viewTarget));
  });

  pixelSongFile?.addEventListener("change", () => handlePixelSongFile(pixelSongFile.files[0]));
  ["dragenter", "dragover"].forEach((type) => {
    pixelDropzone?.addEventListener(type, (event) => {
      event.preventDefault();
      pixelDropzone.classList.add("drag-over");
    });
  });
  ["dragleave", "drop"].forEach((type) => {
    pixelDropzone?.addEventListener(type, () => pixelDropzone.classList.remove("drag-over"));
  });
  pixelDropzone?.addEventListener("drop", (event) => {
    event.preventDefault();
    const file = event.dataTransfer?.files?.[0];
    handlePixelSongFile(file);
  });

  pixelRecordButton?.addEventListener("click", togglePixelRecord);
  pixelPlayButton?.addEventListener("click", togglePixelPlay);
  pixelStyleButton?.addEventListener("click", cycleTuneMode);
  pixelMakeButton?.addEventListener("click", runPixelMakeFromCurrentFile);
  [pixelArtistInput, pixelTitleInput].forEach((control) => {
    control?.addEventListener("input", () => {
      syncPixelLookupToLyrics(state.songFile || pixelSongFile?.files?.[0]);
      updatePixelFront();
      scheduleProjectSave();
    });
  });

  try {
    setFrontView(localStorage.getItem("pixel-ok-view") || "pixel");
  } catch {
    setFrontView("pixel");
  }
}

function wireControls() {
  refreshProjectsButton.addEventListener("click", () => refreshProjects());
  splitButton.addEventListener("click", splitSong);
  harmonyButton.addEventListener("click", splitHarmony);
  stemPlayButton.addEventListener("click", toggleStemPlayback);
  stemTrackButtons.forEach((button) => {
    button.addEventListener("click", () => switchStemTrack(button.dataset.stemTrack));
  });
  [downloadLeadStem, downloadBackingStem].forEach((link) => {
    link?.addEventListener("click", (event) => {
      if (link.classList.contains("disabled")) event.preventDefault();
    });
  });
  stemSeek.addEventListener("input", () => {
    state.stemSeeking = true;
    updateStemTransport(Number(stemSeek.value) || 0);
  });
  stemSeek.addEventListener("change", async () => {
    const keepPlaying = isStemPlaying();
    state.stemSeeking = false;
    await seekStemTrack(Number(stemSeek.value) || 0, keepPlaying);
  });
  searchLyricsButton.addEventListener("click", searchOfficialLyrics);
  autoLyricsButton.addEventListener("click", autoRecognizeLyrics);
  scanLyricsButton.addEventListener("click", async () => {
    await buildLyricCues();
    setStatus(contentStatus, hasLyricText() ? "字幕时间轴已更新，动画会由一键流程继续生成。" : "等待歌词：请填写歌手歌名后点一键制作。");
    updatePipelineStatus();
    scheduleProjectSave();
  });
  visualPlanButton.addEventListener("click", async () => {
    visualPlanButton.disabled = true;
    try {
      await buildLyricCues({ silent: true });
      await requestVisualPlan(estimateDuration(), { force: true });
      scheduleProjectSave();
    } finally {
      visualPlanButton.disabled = false;
      updatePipelineStatus();
    }
  });
  lyricsInput.addEventListener("input", () => {
    invalidateVisualPlan("歌词已改变；一键制作会重新生成字幕时间轴和动画。", { forceStatus: true });
    buildLyricCues({ silent: true });
    scheduleProjectSave();
  });
  [lyricArtist, lyricTitle].forEach((control) => {
    control.addEventListener("change", scheduleProjectSave);
    control.addEventListener("input", () => {
      if (control === lyricTitle && control.value.trim()) state.currentTitle = control.value.trim();
      scheduleProjectSave();
    });
  });
  screenRatio.addEventListener("change", () => {
    applyScreenRatio();
    scheduleProjectSave();
  });
  lyricStyle.addEventListener("change", () => {
    setStatus(contentStatus, `字幕样式已切换：${lyricStyle.options?.[lyricStyle.selectedIndex]?.textContent || lyricStyle.value}`);
    scheduleProjectSave();
  });
  [scanSpeed, animationMode, motionIntensity].forEach((control) => {
    control.addEventListener("input", scheduleProjectSave);
    control.addEventListener("change", scheduleProjectSave);
  });
  previewMvButton.addEventListener("click", togglePixelPreview);
  document.querySelectorAll("[data-lyric-nudge]").forEach((button) => {
    button.addEventListener("click", () => shiftLyricCues(Number(button.dataset.lyricNudge)));
  });
  studioAutoButton?.addEventListener("click", runStudioAutoFromCurrentProject);
  recordButton.addEventListener("click", () => startRecording({ timelineStart: 0 }));
  skipIntroRecordButton?.addEventListener("click", () => {
    const introStart = skipIntroStartTime();
    if (!Number.isFinite(introStart)) {
      setStatus(recordStatus, "需要先拿到歌词时间轴，才能跳到第一句前 5 秒。");
      return;
    }
    startRecording({ timelineStart: introStart });
  });
  stopRecordButton.addEventListener("click", stopRecording);
  redoRecordButton.addEventListener("click", redoRecording);
  playMixButton.addEventListener("click", toggleMixPreview);
  exportMvButton.addEventListener("click", exportMv);
  mixSeek.addEventListener("input", () => {
    state.mixSeeking = true;
    updateMixTransport(Number(mixSeek.value) || 0);
  });
  mixSeek.addEventListener("change", async () => {
    const position = Number(mixSeek.value) || 0;
    const keepPlaying = Boolean(state.activeGraph);
    state.mixSeeking = false;
    await seekMixPreview(position, keepPlaying);
  });

  [vocalOffset, backingGain, vocalGain, mixBackingEnabled].forEach((control) => {
    control.addEventListener("input", () => handleMixControl(control));
    control.addEventListener("change", () => handleMixControl(control));
  });

  autoAlignButton?.addEventListener("click", () => {
    autoAlignRecordedVocal({ silent: false });
  });

  document.querySelectorAll("[data-align-nudge]").forEach((button) => {
    button.addEventListener("click", () => {
      const next = Number(vocalOffset.value || 0) + Number(button.dataset.alignNudge);
      vocalOffset.value = clamp(next, Number(vocalOffset.min) || -30, Number(vocalOffset.max) || 30).toFixed(2);
      handleMixControl(vocalOffset);
    });
  });

  alignmentWaveform?.addEventListener("click", async (event) => {
    const rect = alignmentWaveform.getBoundingClientRect();
    const pct = clamp((event.clientX - rect.left) / Math.max(1, rect.width), 0, 1);
    const duration = Math.max(mixDuration(), state.alignmentReferenceEnvelope?.duration || 0, 1);
    const position = pct * duration;
    state.mixPosition = position;
    await seekMixPreview(position, Boolean(state.activeGraph));
    drawAlignmentWaveform();
  });

  document.querySelectorAll("[data-nudge]").forEach((button) => {
    button.addEventListener("click", () => {
      const next = Number(vocalOffset.value || 0) + Number(button.dataset.nudge);
      vocalOffset.value = clamp(next, Number(vocalOffset.min) || -20, Number(vocalOffset.max) || 20).toFixed(2);
      handleMixControl(vocalOffset);
    });
  });

  presetGrid.addEventListener("click", (event) => {
    const button = event.target.closest("[data-preset]");
    if (!button) return;
    state.activePreset = button.dataset.preset;
    presetGrid.querySelectorAll("button").forEach((item) => {
      item.classList.toggle("active", item === button);
    });
    applyMixSettings();
    setStatus(mixStatus, `已切到 ${button.textContent} 混音效果。`);
  });

  [songAudio, backingAudio, leadAudio, acapellaAudio].forEach((audio) => {
    audio.addEventListener("loadedmetadata", () => {
      if (shouldKeepVisualPlanOnMediaEvent()) {
        updatePipelineStatus();
        return;
      }
      invalidateVisualPlan("音频时长/波形已更新，动画分镜已失效。", { silent: state.loadingProject || !state.visualPlan });
      buildLyricCues({ silent: true });
    });
    audio.addEventListener("durationchange", () => {
      if (shouldKeepVisualPlanOnMediaEvent()) {
        updatePipelineStatus();
        return;
      }
      invalidateVisualPlan("音频时长/波形已更新，动画分镜已失效。", { silent: state.loadingProject || !state.visualPlan });
      buildLyricCues({ silent: true });
    });
  });

  stemTrackItems().forEach((item) => {
    item.audio.addEventListener("loadedmetadata", () => {
      if (item.id === state.activeStemTrack) syncStemAudioTime(item.audio, state.stemPosition);
      updateStemTransport(state.stemPosition);
    });
    item.audio.addEventListener("durationchange", () => updateStemTransport(state.stemPosition));
    item.audio.addEventListener("play", () => {
      pauseStemAudios(item.audio);
      state.activeStemTrack = item.id;
      updateStemTransport(item.audio.currentTime);
      scheduleStemTick();
    });
    item.audio.addEventListener("pause", () => {
      if (item.id === state.activeStemTrack) updateStemTransport(item.audio.currentTime);
    });
    item.audio.addEventListener("timeupdate", () => {
      if (item.id === state.activeStemTrack && !state.stemSeeking) updateStemTransport(item.audio.currentTime);
    });
    item.audio.addEventListener("ended", () => {
      if (item.id !== state.activeStemTrack) return;
      state.stemPosition = stemTimelineDuration();
      cancelAnimationFrame(state.stemRaf);
      setStemLinkedAnimation(false);
      updateStemTransport(state.stemPosition);
    });
  });

  backingAudio.addEventListener("ended", () => {
    if (isRecording()) stopRecording();
    updatePixelFront();
  });
}

applyScreenRatio();
updateMixLabels();
updateMixTransport(0);
wireDropzone();
wireControls();
wirePixelFrontend();
loadCapabilities();
refreshProjects(false);
updatePipelineStatus();
updatePixelFront();
drawPixelScreen();

