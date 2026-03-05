"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { BusinessTabProps } from "@/components/business/v2/BusinessProfileV2";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import {
  AlertCircle,
  Award,
  Bookmark,
  Camera,
  CheckCircle,
  Clock,
  Crosshair,
  Heart,
  MessageSquare,
  Pencil,
  Save,
  Trash2,
  Upload,
  Video,
  Eye,
  X,
  XCircle,
} from "lucide-react";

type MediaType = "photo" | "video";

type UiMediaItem = {
  id: string;
  type: MediaType;
  url: string;
  caption: string;
  description: string;
  isMainPhoto: boolean;
  sortOrder: number;
  focalX: number; // 0-100, percentage from left
  focalY: number; // 0-100, percentage from top
  saves?: number; // UI-only
  likes?: number; // UI-only
  bucket: string;
  path: string;
  adminStatus?: "active" | "investigating" | "banned";
};

type PendingUgc = {
  id: string;
  mediaType: "image" | "video";
  mediaUrl: string;
  caption: string | null;
  tags: string[];
  status: string;
  createdAt: string;
  user: {
    id: string;
    name: string;
    username: string | null;
    avatarUrl: string | null;
  };
};

type UgcComment = {
  id: string;
  experienceId: string;
  body: string;
  createdAt: string;
  likeCount: number;
  user: {
    id: string;
    name: string;
    username: string | null;
    avatarUrl: string | null;
  };
};

const BUCKET_MEDIA = "business-media";

/* Phone screen aspect ratio (9:19.5) — matches Discovery page portrait cards */
const PHONE_AR = 9 / 19.5;

/**
 * FocalPicker — shows image with a smooth SVG mask overlay and a range slider
 * for easy "slide to adjust" positioning. Also supports drag-on-image.
 */
function FocalPicker({
  src,
  caption,
  focalX,
  focalY,
  onMove,
}: {
  src: string;
  caption: string;
  focalX: number;
  focalY: number;
  onMove: (x: number, y: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const dragging = useRef(false);
  const maskId = useRef(`fm-${Math.random().toString(36).slice(2)}`).current;
  const [imgSize, setImgSize] = useState<{ w: number; h: number; natW: number; natH: number } | null>(null);

  const handleLoad = useCallback(() => {
    const img = imgRef.current;
    if (!img) return;
    setImgSize({ w: img.clientWidth, h: img.clientHeight, natW: img.naturalWidth, natH: img.naturalHeight });
  }, []);

  // Handle cached images that fire onLoad before mount
  useEffect(() => {
    const img = imgRef.current;
    if (img && img.complete && img.naturalWidth > 0) handleLoad();
  }, [handleLoad]);

  // Which axis can slide?
  const axis = useMemo(() => {
    if (!imgSize) return "none" as const;
    const imgAR = imgSize.natW / imgSize.natH;
    if (imgAR > PHONE_AR + 0.01) return "horizontal" as const;
    if (imgAR < PHONE_AR - 0.01) return "vertical" as const;
    return "none" as const;
  }, [imgSize]);

  // Compute the visible-area rectangle in rendered-image pixel coordinates
  const rect = useMemo(() => {
    if (!imgSize) return null;
    const { w: rW, h: rH, natW, natH } = imgSize;
    const imgAR = natW / natH;
    let rectW: number, rectH: number;
    if (imgAR > PHONE_AR) { rectH = rH; rectW = rH * PHONE_AR; }
    else { rectW = rW; rectH = rW / PHONE_AR; }
    rectW = Math.min(rectW, rW);
    rectH = Math.min(rectH, rH);
    const maxOffsetX = rW - rectW;
    const maxOffsetY = rH - rectH;
    const left = maxOffsetX * (focalX / 100);
    const top = maxOffsetY * (focalY / 100);
    return { left, top, width: rectW, height: rectH };
  }, [imgSize, focalX, focalY]);

  // Drag-on-image: calculate focal % from pointer position
  const calcFocal = useCallback((clientX: number, clientY: number) => {
    if (!imgSize || !imgRef.current) return;
    const imgRect = imgRef.current.getBoundingClientRect();
    const mx = clientX - imgRect.left;
    const my = clientY - imgRect.top;
    const { w: rW, h: rH, natW, natH } = imgSize;
    const imgAR = natW / natH;
    let rectW: number, rectH: number;
    if (imgAR > PHONE_AR) { rectH = rH; rectW = rH * PHONE_AR; }
    else { rectW = rW; rectH = rW / PHONE_AR; }
    rectW = Math.min(rectW, rW);
    rectH = Math.min(rectH, rH);
    const maxOffsetX = rW - rectW;
    const maxOffsetY = rH - rectH;
    const newX = maxOffsetX > 0 ? Math.max(0, Math.min(100, ((mx - rectW / 2) / maxOffsetX) * 100)) : 50;
    const newY = maxOffsetY > 0 ? Math.max(0, Math.min(100, ((my - rectH / 2) / maxOffsetY) * 100)) : 50;
    onMove(newX, newY);
  }, [imgSize, onMove]);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    dragging.current = true;
    containerRef.current?.setPointerCapture(e.pointerId);
    calcFocal(e.clientX, e.clientY);
  }, [calcFocal]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging.current) return;
    calcFocal(e.clientX, e.clientY);
  }, [calcFocal]);

  const handlePointerUp = useCallback(() => { dragging.current = false; }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.75rem" }}>
      {/* Image with SVG mask overlay + drag support */}
      <div
        ref={containerRef}
        style={{ position: "relative", display: "inline-block", cursor: "grab", userSelect: "none", touchAction: "none", borderRadius: "12px", overflow: "hidden" }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        <img
          ref={imgRef}
          src={src}
          alt={caption}
          onLoad={handleLoad}
          draggable={false}
          style={{ display: "block", maxWidth: "100%", maxHeight: "50vh" }}
        />
        {imgSize && rect && (
          <svg
            style={{ position: "absolute", top: 0, left: 0, pointerEvents: "none" }}
            width={imgSize.w}
            height={imgSize.h}
          >
            <defs>
              <mask id={maskId}>
                <rect width={imgSize.w} height={imgSize.h} fill="white" />
                <rect x={rect.left} y={rect.top} width={rect.width} height={rect.height} fill="black" rx="4" />
              </mask>
            </defs>
            {/* Dark overlay with transparent cutout */}
            <rect width={imgSize.w} height={imgSize.h} fill="rgba(0,0,0,0.55)" mask={`url(#${maskId})`} />
            {/* Visible area border */}
            <rect x={rect.left} y={rect.top} width={rect.width} height={rect.height} fill="none" stroke="rgba(255,255,255,0.8)" strokeWidth="2" rx="4" />
            {/* Label */}
            <text x={rect.left + 10} y={rect.top + 18} fill="rgba(255,255,255,0.9)" fontSize="11" fontWeight="700" fontFamily="system-ui, sans-serif">
              Visible on Discovery
            </text>
          </svg>
        )}
      </div>

      {/* Range slider for easy adjustment */}
      {axis === "horizontal" && (
        <div style={{ width: "100%", maxWidth: imgSize?.w ?? 400, padding: "0 0.5rem" }}>
          <div style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.5)", marginBottom: "0.35rem", textAlign: "center" }}>
            Slide to adjust horizontal position
          </div>
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round(focalX)}
            onChange={(e) => onMove(Number(e.target.value), focalY)}
            style={{ width: "100%", accentColor: "#14b8a6", cursor: "pointer" }}
          />
        </div>
      )}
      {axis === "vertical" && (
        <div style={{ width: "100%", maxWidth: imgSize?.w ?? 400, padding: "0 0.5rem" }}>
          <div style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.5)", marginBottom: "0.35rem", textAlign: "center" }}>
            Slide to adjust vertical position
          </div>
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round(focalY)}
            onChange={(e) => onMove(focalX, Number(e.target.value))}
            style={{ width: "100%", accentColor: "#14b8a6", cursor: "pointer" }}
          />
        </div>
      )}
      {axis === "none" && imgSize && (
        <div style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.45)", textAlign: "center" }}>
          This image fits the Discovery screen perfectly — no adjustment needed.
        </div>
      )}
    </div>
  );
}

export default function Media({ businessId, isPremium }: BusinessTabProps) {
  const colors = useMemo(
    () => ({
      primary: "#14b8a6",
      secondary: "#f97316",
      accent: "#06b6d4",
      success: "#10b981",
      warning: "#f59e0b",
      danger: "#ef4444",
      purple: "#a855f7",
    }),
    []
  );

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [mediaGallery, setMediaGallery] = useState<UiMediaItem[]>([]);
  const photos = useMemo(() => mediaGallery.filter((m) => m.type === "photo"), [mediaGallery]);
  const videos = useMemo(() => mediaGallery.filter((m) => m.type === "video"), [mediaGallery]);

  const [uploading, setUploading] = useState(false);

  const [showPhotoUploadModal, setShowPhotoUploadModal] = useState(false);
  const [showVideoUploadModal, setShowVideoUploadModal] = useState(false);
  const [viewingMedia, setViewingMedia] = useState<UiMediaItem | null>(null);
  const [stagedPhotos, setStagedPhotos] = useState<File[]>([]);
  const [stagedVideo, setStagedVideo] = useState<File | null>(null);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [settingFocal, setSettingFocal] = useState(false);
  const [focalPreview, setFocalPreview] = useState<{ x: number; y: number } | null>(null);
  const [naturalSize, setNaturalSize] = useState<{ w: number; h: number } | null>(null);

  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const videoInputRef = useRef<HTMLInputElement | null>(null);

  // Uncontrolled modal fields (fix focus-loss)
  const photoTitleRef = useRef<HTMLInputElement | null>(null);
  const photoDescRef = useRef<HTMLTextAreaElement | null>(null);
  const videoTitleRef = useRef<HTMLInputElement | null>(null);
  const videoDescRef = useRef<HTMLTextAreaElement | null>(null);
  const videoSetActiveRef = useRef<HTMLInputElement | null>(null);

  const videoUploadLocked = !isPremium;

  // UGC pending approval
  const [pendingUgc, setPendingUgc] = useState<PendingUgc[]>([]);
  const [pendingUgcLoading, setPendingUgcLoading] = useState(false);
  const [previewingUgc, setPreviewingUgc] = useState<PendingUgc | null>(null);
  const [ugcActionLoading, setUgcActionLoading] = useState<string | null>(null);

  const fetchPendingUgc = useCallback(async () => {
    if (!businessId) return;
    setPendingUgcLoading(true);
    try {
      const { data: session } = await supabaseBrowser.auth.getSession();
      const token = session?.session?.access_token;
      if (!token) return;

      const res = await fetch(
        `/api/businesses/${businessId}/ugc?status=pending`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.ok) {
        const json = await res.json();
        setPendingUgc(json.submissions ?? []);
      }
    } catch (err) {
      console.error("Failed to fetch pending UGC:", err);
    } finally {
      setPendingUgcLoading(false);
    }
  }, [businessId]);

  useEffect(() => {
    fetchPendingUgc();
  }, [fetchPendingUgc]);

  const pendingUgcCount = pendingUgc.length;

  // Computed from actual media data
  const videoLimits = useMemo(
    () => ({
      activeVideos: videos.filter((v) => v.adminStatus !== "banned").length,
      maxActiveVideos: isPremium ? 10 : 5,
      libraryVideos: videos.length,
      maxLibraryVideos: isPremium ? 50 : 25,
      pendingApproval: pendingUgcCount,
    }),
    [videos, isPremium, pendingUgcCount]
  );

  const handleUgcAction = async (submissionId: string, action: "approve" | "reject") => {
    try {
      setUgcActionLoading(submissionId);
      const { data: session } = await supabaseBrowser.auth.getSession();
      const token = session?.session?.access_token;
      if (!token) return;

      const res = await fetch(`/api/businesses/${businessId}/ugc`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ submissionId, action }),
      });

      if (res.ok) {
        // Remove from local list
        setPendingUgc((prev) => prev.filter((u) => u.id !== submissionId));
        if (previewingUgc?.id === submissionId) setPreviewingUgc(null);
      } else {
        const data = await res.json();
        alert(data.error || `Failed to ${action}`);
      }
    } catch (err) {
      console.error(`UGC ${action} failed:`, err);
      alert(`Failed to ${action}. Please try again.`);
    } finally {
      setUgcActionLoading(null);
    }
  };

  // ─── Comment moderation state (post-centric) ───
  type CommentPost = {
    id: string;
    mediaType: string;
    mediaUrl: string;
    caption: string | null;
    status: string;
    createdAt: string;
    commentCount: number;
    submitter: { id: string; name: string; username: string | null; avatarUrl: string | null };
  };

  const [commentPosts, setCommentPosts] = useState<CommentPost[]>([]);
  const [commentPostsLoading, setCommentPostsLoading] = useState(false);
  const [totalCommentCount, setTotalCommentCount] = useState(0);
  const [expandedPostId, setExpandedPostId] = useState<string | null>(null);
  const [expandedComments, setExpandedComments] = useState<UgcComment[]>([]);
  const [expandedCommentsLoading, setExpandedCommentsLoading] = useState(false);
  const [expandedCommentsPage, setExpandedCommentsPage] = useState(1);
  const [expandedCommentsTotalPages, setExpandedCommentsTotalPages] = useState(0);
  const [expandedCommentsTotalRows, setExpandedCommentsTotalRows] = useState(0);
  const [commentSearch, setCommentSearch] = useState("");
  const commentSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [commentDeleteLoading, setCommentDeleteLoading] = useState<string | null>(null);

  // Fetch posts that have comments
  const fetchCommentPosts = useCallback(async () => {
    if (!businessId) return;
    setCommentPostsLoading(true);
    try {
      const { data: session } = await supabaseBrowser.auth.getSession();
      const token = session?.session?.access_token;
      if (!token) return;

      const res = await fetch(
        `/api/businesses/${businessId}/ugc/comments?mode=posts`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.ok) {
        const json = await res.json();
        setCommentPosts(json.posts ?? []);
        setTotalCommentCount(json.totalComments ?? 0);
      }
    } catch (err) {
      console.error("Failed to fetch comment posts:", err);
    } finally {
      setCommentPostsLoading(false);
    }
  }, [businessId]);

  useEffect(() => {
    fetchCommentPosts();
  }, [fetchCommentPosts]);

  // Fetch comments for a specific post (paginated + searchable)
  const fetchPostComments = useCallback(async (experienceId: string, pg = 1, search = "") => {
    if (!businessId) return;
    setExpandedCommentsLoading(true);
    try {
      const { data: session } = await supabaseBrowser.auth.getSession();
      const token = session?.session?.access_token;
      if (!token) return;

      const searchParam = search ? `&search=${encodeURIComponent(search)}` : "";
      const res = await fetch(
        `/api/businesses/${businessId}/ugc/comments?experienceId=${experienceId}&page=${pg}&limit=20${searchParam}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.ok) {
        const json = await res.json();
        setExpandedComments(json.comments ?? []);
        setExpandedCommentsPage(json.pagination?.page ?? pg);
        setExpandedCommentsTotalPages(json.pagination?.totalPages ?? 0);
        setExpandedCommentsTotalRows(json.pagination?.totalRows ?? 0);
      }
    } catch (err) {
      console.error("Failed to fetch post comments:", err);
    } finally {
      setExpandedCommentsLoading(false);
    }
  }, [businessId]);

  const handleExpandPost = useCallback((postId: string) => {
    if (expandedPostId === postId) {
      setExpandedPostId(null);
      setExpandedComments([]);
      setCommentSearch("");
    } else {
      setExpandedPostId(postId);
      setExpandedCommentsPage(1);
      setCommentSearch("");
      fetchPostComments(postId, 1, "");
    }
  }, [expandedPostId, fetchPostComments]);

  // Search handler with debounce
  const handleCommentSearchChange = useCallback((value: string, postId: string) => {
    setCommentSearch(value);
    if (commentSearchTimer.current) clearTimeout(commentSearchTimer.current);
    commentSearchTimer.current = setTimeout(() => {
      setExpandedCommentsPage(1);
      fetchPostComments(postId, 1, value.trim());
    }, 400);
  }, [fetchPostComments]);

  const handleDeleteComment = async (commentId: string, experienceId: string) => {
    if (!confirm("Delete this comment? This cannot be undone.")) return;
    try {
      setCommentDeleteLoading(commentId);
      const { data: session } = await supabaseBrowser.auth.getSession();
      const token = session?.session?.access_token;
      if (!token) return;

      const res = await fetch(`/api/businesses/${businessId}/ugc/comments`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ commentId }),
      });

      if (res.ok) {
        setExpandedComments((prev) => prev.filter((c) => c.id !== commentId));
        // Update the post's comment count
        setCommentPosts((prev) =>
          prev.map((p) =>
            p.id === experienceId ? { ...p, commentCount: Math.max(0, p.commentCount - 1) } : p
          ).filter((p) => p.commentCount > 0)
        );
        setTotalCommentCount((prev) => Math.max(0, prev - 1));
      } else {
        const data = await res.json();
        alert(data.error || "Failed to delete comment");
      }
    } catch (err) {
      console.error("Comment delete failed:", err);
      alert("Failed to delete comment. Please try again.");
    } finally {
      setCommentDeleteLoading(null);
    }
  };

  function normalizeErr(e: unknown): string {
    if (!e) return "Unknown error.";
    if (typeof e === "string") return e;
    if (e instanceof Error) return e.message || "Unknown error.";
    try {
      const anyE = e as any;
      const parts = [
        anyE?.message ? `message=${anyE.message}` : null,
        anyE?.details ? `details=${anyE.details}` : null,
        anyE?.hint ? `hint=${anyE.hint}` : null,
        anyE?.code ? `code=${anyE.code}` : null,
      ].filter(Boolean);
      return parts.length ? parts.join(" | ") : JSON.stringify(e);
    } catch {
      return "Unknown error (non-serializable).";
    }
  }

  function normalizeMediaType(raw: any): MediaType {
    const s = String(raw ?? "").toLowerCase();
    if (s.includes("video")) return "video";
    return "photo";
  }

  async function getBestUrl(bucket: string, path: string): Promise<string> {
    const pub = supabaseBrowser.storage.from(bucket).getPublicUrl(path);
    const publicUrl = pub?.data?.publicUrl ?? "";
    if (publicUrl) return publicUrl;

    const { data, error } = await supabaseBrowser.storage.from(bucket).createSignedUrl(path, 60 * 60);
    if (error) return "";
    return data?.signedUrl ?? "";
  }

  // ✅ robust auth fetch (handles hydration timing)
  async function getAuthedUserId(): Promise<string | null> {
    // try getUser (usually most reliable)
    const u1 = await supabaseBrowser.auth.getUser();
    const id1 = u1.data.user?.id ?? null;
    if (id1) return id1;

    // try getSession
    const s1 = await supabaseBrowser.auth.getSession();
    const id2 = s1.data.session?.user?.id ?? null;
    if (id2) return id2;

    // small retry loop (covers “session not hydrated yet”)
    for (let i = 0; i < 4; i++) {
      await new Promise((r) => setTimeout(r, 250));
      const u = await supabaseBrowser.auth.getUser();
      const id = u.data.user?.id ?? null;
      if (id) return id;
    }

    return null;
  }

  function nextPhotoSortOrder() {
    const existing = mediaGallery.filter((m) => m.type === "photo");
    if (existing.length === 0) return 0;
    const max = existing.reduce((mx, p) => Math.max(mx, Number.isFinite(p.sortOrder) ? p.sortOrder : 0), 0);
    return max + 1;
  }

  // Load media (your schema)
  useEffect(() => {
    let mounted = true;

    async function loadMedia() {
      if (!businessId) return;

      setLoading(true);
      setLoadError(null);

      try {
        const { data, error } = await supabaseBrowser
          .from("business_media")
          .select("*")
          .eq("business_id", businessId)
          .eq("bucket", BUCKET_MEDIA)
          .eq("is_active", true)
          .order("sort_order", { ascending: true })
          .order("created_at", { ascending: false });

        if (error) throw error;

        const rows = (data ?? []) as Array<Record<string, any>>;
        const mapped: UiMediaItem[] = [];

        for (const r of rows) {
          const id = String(r.id ?? "");
          const bucket = String(r.bucket ?? BUCKET_MEDIA);
          const path = String(r.path ?? "");
          if (!id || !path) continue;

          const type = normalizeMediaType(r.media_type);
          const sortOrder = Number.isFinite(Number(r.sort_order)) ? Number(r.sort_order) : 9999;
          const isMainPhoto = type === "photo" && sortOrder === 0;

          const caption = String(r.caption ?? "(untitled)");
          const url = await getBestUrl(bucket, path);

          // Check both dedicated column and meta JSONB fallback
          const metaObj = (r.meta ?? {}) as Record<string, unknown>;
          const description = String(metaObj.description ?? "");
          const focalX = Number(metaObj.focal_x ?? 50);
          const focalY = Number(metaObj.focal_y ?? 30);
          const rawAdminStatus = String(r.admin_status ?? metaObj.admin_status ?? "active");
          const adminStatus = (["active", "investigating", "banned"].includes(rawAdminStatus)
            ? rawAdminStatus
            : "active") as "active" | "investigating" | "banned";

          mapped.push({
            id,
            type,
            url,
            caption,
            description,
            isMainPhoto,
            sortOrder,
            focalX,
            focalY,
            saves: type === "photo" ? Math.floor(50 + Math.random() * 250) : undefined,
            likes: type === "video" ? Math.floor(50 + Math.random() * 500) : undefined,
            bucket,
            path,
            adminStatus,
          });
        }

        if (!mounted) return;
        setMediaGallery(mapped);
      } catch (e) {
        const msg = normalizeErr(e);
        console.error("Media load error:", e, msg);
        if (!mounted) return;
        setLoadError(msg);
      } finally {
        if (!mounted) return;
        setLoading(false);
      }
    }

    loadMedia();
    return () => {
      mounted = false;
    };
  }, [businessId]);

  async function uploadFiles(kind: MediaType, files: FileList | null) {
    if (!files || files.length === 0) return;
    if (!businessId) return;

    if (kind === "video" && videoUploadLocked) {
      alert("Video uploads are Premium-only.");
      return;
    }

    const title =
      kind === "photo"
        ? (photoTitleRef.current?.value?.trim() ?? "")
        : (videoTitleRef.current?.value?.trim() ?? "");
    const desc =
      kind === "photo"
        ? (photoDescRef.current?.value?.trim() ?? "")
        : (videoDescRef.current?.value?.trim() ?? "");
    const activeVideo = Boolean(videoSetActiveRef.current?.checked);

    try {
      setUploading(true);

      const userId = await getAuthedUserId();
      if (!userId) {
        alert("Session not found. Please sign out and sign back in (or use Reset Session) then try again.");
        return;
      }

      const newItems: UiMediaItem[] = [];

      for (const file of Array.from(files)) {
        const ext = file.name.includes(".") ? file.name.split(".").pop() : "";
        const safeExt = ext ? `.${ext}` : "";
        const storagePath = `${businessId}/${Date.now()}-${Math.random().toString(16).slice(2)}${safeExt}`;

        // 1) upload to storage
        const { error: upErr } = await supabaseBrowser.storage.from(BUCKET_MEDIA).upload(storagePath, file, {
          cacheControl: "3600",
          upsert: false,
          contentType: file.type,
        });
        if (upErr) throw upErr;

        // 2) insert db row (YOUR schema)
        const sortOrder = kind === "photo"
          ? nextPhotoSortOrder()
          : mediaGallery.filter(m => m.type === "video").length + newItems.filter(m => m.type === "video").length;

        const meta: Record<string, any> = {};
        if (desc) meta.description = desc;
        if (kind === "video") meta.set_active_video = activeVideo;

        const { data: inserted, error: insErr } = await supabaseBrowser
          .from("business_media")
          .insert({
            business_id: businessId,
            bucket: BUCKET_MEDIA,
            path: storagePath,
            media_type: kind,
            sort_order: sortOrder,
            caption: title || file.name,
            is_active: true,
            uploaded_by: userId,
            meta,
          })
          .select("id,bucket,path,media_type,sort_order,caption")
          .single();

        if (insErr) throw insErr;

        const url = await getBestUrl(BUCKET_MEDIA, storagePath);

        newItems.push({
          id: String(inserted.id),
          type: normalizeMediaType(inserted.media_type),
          url,
          caption: String(inserted.caption ?? title ?? file.name),
          description: desc,
          isMainPhoto: kind === "photo" ? sortOrder === 0 : false,
          focalX: 50,
          focalY: 30,
          sortOrder: kind === "photo" ? (sortOrder ?? 9999) : 9999,
          saves: kind === "photo" ? Math.floor(50 + Math.random() * 250) : undefined,
          likes: kind === "video" ? Math.floor(50 + Math.random() * 500) : undefined,
          bucket: String(inserted.bucket ?? BUCKET_MEDIA),
          path: String(inserted.path ?? storagePath),
        });
      }

      setMediaGallery((prev) => [...newItems, ...prev]);

      // Sync uploaded media to business table (photos/videos arrays) so Admin can see them
      // Uses server-side API to bypass RLS on the business table
      try {
        await fetch(`/api/businesses/${businessId}/media-sync`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "add",
            field: kind === "photo" ? "photos" : "videos",
            entries: newItems.map((item) => ({
              id: item.id,
              name: item.caption,
              url: item.url,
              status: "active",
              uploaded_at: new Date().toISOString(),
            })),
          }),
        });
      } catch (syncErr) {
        console.error("[Media] Admin sync warning:", syncErr);
        // Non-critical: upload succeeded, just admin sync failed
      }

      // clear modal fields
      if (photoTitleRef.current) photoTitleRef.current.value = "";
      if (photoDescRef.current) photoDescRef.current.value = "";
      if (videoTitleRef.current) videoTitleRef.current.value = "";
      if (videoDescRef.current) videoDescRef.current.value = "";
      if (videoSetActiveRef.current) videoSetActiveRef.current.checked = false;

      alert("(Saved) Upload complete.");
    } catch (e) {
      alert(normalizeErr(e));
    } finally {
      setUploading(false);
    }
  }

  async function setMainPhoto(target: UiMediaItem) {
    if (target.type !== "photo" || target.isMainPhoto) return;
    try {
      setUploading(true);

      // Find current main photo (sort_order 0)
      const currentMain = mediaGallery.find((m) => m.type === "photo" && m.isMainPhoto);

      // Swap sort_order: target becomes 0, old main gets target's old sort_order
      const targetOldSort = target.sortOrder;

      const { error: e1 } = await supabaseBrowser
        .from("business_media")
        .update({ sort_order: 0 })
        .eq("id", target.id)
        .eq("business_id", businessId);
      if (e1) throw e1;

      if (currentMain) {
        const { error: e2 } = await supabaseBrowser
          .from("business_media")
          .update({ sort_order: targetOldSort })
          .eq("id", currentMain.id)
          .eq("business_id", businessId);
        if (e2) throw e2;
      }

      // Update local state
      setMediaGallery((prev) =>
        prev.map((m) => {
          if (m.id === target.id) return { ...m, sortOrder: 0, isMainPhoto: true };
          if (currentMain && m.id === currentMain.id) return { ...m, sortOrder: targetOldSort, isMainPhoto: false };
          return m;
        })
      );
      setViewingMedia((prev) => prev && prev.id === target.id ? { ...prev, sortOrder: 0, isMainPhoto: true } : prev);
    } catch (e) {
      alert(normalizeErr(e));
    } finally {
      setUploading(false);
    }
  }

  async function saveMediaEdit(target: UiMediaItem) {
    const newCaption = editTitle.trim();
    if (!newCaption) { alert("Title cannot be empty."); return; }
    const newDesc = editDesc.trim();

    try {
      setUploading(true);

      // Read current meta so we don't overwrite other fields
      const { data: row, error: readErr } = await supabaseBrowser
        .from("business_media")
        .select("meta")
        .eq("id", target.id)
        .eq("business_id", businessId)
        .maybeSingle();
      if (readErr) throw readErr;

      const existingMeta = (row?.meta ?? {}) as Record<string, unknown>;
      const updatedMeta = { ...existingMeta, description: newDesc || undefined };
      // Remove description key if empty
      if (!newDesc) delete updatedMeta.description;

      const { error } = await supabaseBrowser
        .from("business_media")
        .update({ caption: newCaption, meta: updatedMeta })
        .eq("id", target.id)
        .eq("business_id", businessId);
      if (error) throw error;

      // Update local state
      setMediaGallery((prev) =>
        prev.map((m) => m.id === target.id ? { ...m, caption: newCaption, description: newDesc } : m)
      );
      setViewingMedia((prev) => prev && prev.id === target.id ? { ...prev, caption: newCaption, description: newDesc } : prev);
      setEditing(false);
    } catch (e) {
      alert(normalizeErr(e));
    } finally {
      setUploading(false);
    }
  }

  async function saveFocalPoint(target: UiMediaItem, x: number, y: number) {
    try {
      setUploading(true);

      const { data: row, error: readErr } = await supabaseBrowser
        .from("business_media")
        .select("meta")
        .eq("id", target.id)
        .eq("business_id", businessId)
        .maybeSingle();
      if (readErr) throw readErr;

      const existingMeta = (row?.meta ?? {}) as Record<string, unknown>;
      const updatedMeta = { ...existingMeta, focal_x: Math.round(x), focal_y: Math.round(y) };

      const { error } = await supabaseBrowser
        .from("business_media")
        .update({ meta: updatedMeta })
        .eq("id", target.id)
        .eq("business_id", businessId);
      if (error) throw error;

      setMediaGallery((prev) =>
        prev.map((m) => m.id === target.id ? { ...m, focalX: Math.round(x), focalY: Math.round(y) } : m)
      );
      setViewingMedia((prev) => prev && prev.id === target.id ? { ...prev, focalX: Math.round(x), focalY: Math.round(y) } : prev);
      setSettingFocal(false);
      setFocalPreview(null);
    } catch (e) {
      alert(normalizeErr(e));
    } finally {
      setUploading(false);
    }
  }

  async function deleteMedia(target: UiMediaItem) {
    try {
      setUploading(true);
      const { error } = await supabaseBrowser
        .from("business_media")
        .update({ is_active: false })
        .eq("id", target.id)
        .eq("business_id", businessId);

      if (error) throw error;

      setMediaGallery((prev) => prev.filter((m) => m.id !== target.id));
      setViewingMedia(null);

      // Also remove from business table photos/videos array for admin sync
      try {
        await fetch(`/api/businesses/${businessId}/media-sync`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "remove",
            field: target.type === "photo" ? "photos" : "videos",
            entries: [{ id: target.id }],
          }),
        });
      } catch (syncErr) {
        console.error("[Media] Admin sync (delete) warning:", syncErr);
      }

      alert("(Saved) Media removed (soft delete).");
    } catch (e) {
      alert(normalizeErr(e));
    } finally {
      setUploading(false);
    }
  }

  return (
    <div>
      {/* Keep Claude stats + pending approvals */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
          gap: "1rem",
          marginBottom: "2rem",
        }}
      >
        <StatCard label="Active Videos" value={`${videoLimits.activeVideos} / ${videoLimits.maxActiveVideos}`} icon={<Video size={18} />} color={colors.primary} progress={videoLimits.activeVideos / videoLimits.maxActiveVideos} />
        <StatCard label="Library Videos" value={`${videoLimits.libraryVideos} / ${videoLimits.maxLibraryVideos}`} icon={<Camera size={18} />} color={colors.accent} progress={videoLimits.libraryVideos / videoLimits.maxLibraryVideos} />
        <StatCard label="Pending Approval" value={`${videoLimits.pendingApproval}`} icon={<Clock size={18} />} color={colors.warning} />
      </div>

      <div
        style={{
          background: "rgba(255, 255, 255, 0.03)",
          backdropFilter: "blur(20px)",
          border: "1px solid rgba(255, 255, 255, 0.08)",
          borderRadius: "16px",
          padding: "2rem",
          marginBottom: "2rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1.25rem" }}>
          <AlertCircle size={18} style={{ color: colors.warning }} />
          <div style={{ fontSize: "1.1rem", fontWeight: 900 }}>
            Submissions Pending Your Approval
            {pendingUgcCount > 0 && (
              <span style={{ fontSize: "0.8rem", fontWeight: 600, color: colors.warning, marginLeft: 8 }}>
                ({pendingUgcCount})
              </span>
            )}
          </div>
        </div>

        {pendingUgcLoading ? (
          <div style={{ padding: "2rem", textAlign: "center", color: "rgba(255,255,255,0.5)", fontSize: "0.9rem" }}>
            Loading submissions...
          </div>
        ) : pendingUgc.length === 0 ? (
          <div style={{ padding: "2rem", textAlign: "center", color: "rgba(255,255,255,0.4)", fontSize: "0.9rem" }}>
            No pending submissions
          </div>
        ) : (
          <div style={{ display: "grid", gap: "0.75rem" }}>
            {pendingUgc.map((u) => (
              <div
                key={u.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "1rem",
                  padding: "1rem",
                  background: "rgba(255, 255, 255, 0.02)",
                  borderRadius: "12px",
                  border: "1px solid rgba(255, 255, 255, 0.05)",
                  flexWrap: "wrap",
                }}
              >
                {/* Thumbnail */}
                <div
                  style={{
                    width: 120,
                    height: 80,
                    borderRadius: 10,
                    overflow: "hidden",
                    background: "rgba(0,0,0,0.3)",
                    flexShrink: 0,
                    position: "relative",
                    cursor: "pointer",
                  }}
                  onClick={() => setPreviewingUgc(u)}
                >
                  {u.mediaType === "video" ? (
                    <>
                      <video
                        src={u.mediaUrl}
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                        muted
                        preload="metadata"
                      />
                      <div
                        style={{
                          position: "absolute",
                          inset: 0,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          background: "rgba(0,0,0,0.3)",
                        }}
                      >
                        <Video size={24} style={{ color: "#fff" }} />
                      </div>
                    </>
                  ) : (
                    <img
                      src={u.mediaUrl}
                      alt={u.caption || "UGC"}
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                  )}
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 150 }}>
                  <div style={{ fontWeight: 900, fontSize: "0.95rem" }}>
                    {u.caption ? (u.caption.length > 50 ? u.caption.slice(0, 50) + "..." : u.caption) : "No caption"}
                  </div>
                  <div style={{ fontSize: "0.8rem", color: "rgba(255,255,255,0.6)", marginTop: 2 }}>
                    by {u.user.name}{u.user.username ? ` (@${u.user.username})` : ""} • {new Date(u.createdAt).toLocaleDateString()}
                  </div>
                  {u.tags.length > 0 && (
                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 6 }}>
                      {u.tags.slice(0, 5).map((t) => (
                        <span
                          key={t}
                          style={{
                            fontSize: "0.65rem",
                            padding: "2px 8px",
                            borderRadius: 50,
                            background: `${colors.accent}15`,
                            border: `1px solid ${colors.accent}30`,
                            color: colors.accent,
                          }}
                        >
                          #{t}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div style={{ display: "flex", gap: "0.5rem", flexShrink: 0 }}>
                  <button
                    type="button"
                    style={pillBtn(`${colors.accent}20`, colors.accent)}
                    onClick={() => setPreviewingUgc(u)}
                  >
                    <Eye size={14} /> View
                  </button>
                  <button
                    type="button"
                    style={{
                      ...pillBtn(`${colors.success}20`, colors.success),
                      opacity: ugcActionLoading === u.id ? 0.5 : 1,
                    }}
                    disabled={ugcActionLoading === u.id}
                    onClick={() => handleUgcAction(u.id, "approve")}
                  >
                    <CheckCircle size={14} /> Approve
                  </button>
                  <button
                    type="button"
                    style={{
                      ...pillBtn(`${colors.danger}20`, colors.danger),
                      opacity: ugcActionLoading === u.id ? 0.5 : 1,
                    }}
                    disabled={ugcActionLoading === u.id}
                    onClick={() => handleUgcAction(u.id, "reject")}
                  >
                    <XCircle size={14} /> Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* UGC Preview Modal */}
      {previewingUgc && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          onClick={() => setPreviewingUgc(null)}
        >
          <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.8)", backdropFilter: "blur(8px)" }} />
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: "relative",
              width: "94%",
              maxWidth: 750,
              maxHeight: "92vh",
              borderRadius: 16,
              background: "#0f0f1a",
              border: "1px solid rgba(255,255,255,0.1)",
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
              boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
            }}
          >
            {/* Close button */}
            <button
              onClick={() => setPreviewingUgc(null)}
              style={{
                position: "absolute",
                top: 12,
                right: 12,
                zIndex: 10,
                background: "rgba(0,0,0,0.5)",
                border: "none",
                borderRadius: "50%",
                width: 32,
                height: 32,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
              }}
            >
              <X size={16} style={{ color: "#fff" }} />
            </button>

            {/* Media */}
            <div style={{ width: "100%", maxHeight: "65vh", background: "#000", display: "flex", alignItems: "center", justifyContent: "center" }}>
              {previewingUgc.mediaType === "video" ? (
                <video
                  src={previewingUgc.mediaUrl}
                  controls
                  autoPlay
                  style={{ width: "100%", maxHeight: "65vh", objectFit: "contain" }}
                />
              ) : (
                <img
                  src={previewingUgc.mediaUrl}
                  alt={previewingUgc.caption || "UGC"}
                  style={{ width: "100%", maxHeight: "65vh", objectFit: "contain" }}
                />
              )}
            </div>

            {/* Details */}
            <div style={{ padding: "16px 20px", flex: 1, overflowY: "auto" }}>
              <div style={{ fontSize: "0.85rem", color: "rgba(255,255,255,0.5)", marginBottom: 4 }}>
                {previewingUgc.user.name}{previewingUgc.user.username ? ` (@${previewingUgc.user.username})` : ""}
                {" "}• {new Date(previewingUgc.createdAt).toLocaleString()}
              </div>
              {previewingUgc.caption && (
                <p style={{ fontSize: "0.95rem", color: "#fff", margin: "8px 0", lineHeight: 1.5 }}>
                  {previewingUgc.caption}
                </p>
              )}
              {previewingUgc.tags.length > 0 && (
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
                  {previewingUgc.tags.map((t) => (
                    <span
                      key={t}
                      style={{
                        fontSize: "0.75rem",
                        padding: "3px 10px",
                        borderRadius: 50,
                        background: `${colors.accent}15`,
                        border: `1px solid ${colors.accent}30`,
                        color: colors.accent,
                      }}
                    >
                      #{t}
                    </span>
                  ))}
                </div>
              )}

              {/* Approve / Reject buttons */}
              <div style={{ display: "flex", gap: "0.75rem", marginTop: 20 }}>
                <button
                  type="button"
                  style={{
                    ...pillBtn(`${colors.success}20`, colors.success),
                    flex: 1,
                    justifyContent: "center",
                    padding: "12px 16px",
                    fontSize: "0.9rem",
                    opacity: ugcActionLoading === previewingUgc.id ? 0.5 : 1,
                  }}
                  disabled={ugcActionLoading === previewingUgc.id}
                  onClick={() => handleUgcAction(previewingUgc.id, "approve")}
                >
                  <CheckCircle size={16} /> Approve
                </button>
                <button
                  type="button"
                  style={{
                    ...pillBtn(`${colors.danger}20`, colors.danger),
                    flex: 1,
                    justifyContent: "center",
                    padding: "12px 16px",
                    fontSize: "0.9rem",
                    opacity: ugcActionLoading === previewingUgc.id ? 0.5 : 1,
                  }}
                  disabled={ugcActionLoading === previewingUgc.id}
                  onClick={() => handleUgcAction(previewingUgc.id, "reject")}
                >
                  <XCircle size={16} /> Reject
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Upload section */}
      {loading && <div style={banner("rgba(255,255,255,0.03)", "1px solid rgba(255,255,255,0.08)", "rgba(255,255,255,0.75)")}>Loading media…</div>}
      {loadError && <div style={banner("rgba(239,68,68,0.10)", "1px solid rgba(239,68,68,0.30)", "rgba(255,255,255,0.9)")}>Media load failed: {loadError}</div>}

      <div style={panel()}>
        <div style={panelTitle()}>
          <Upload size={20} style={{ color: colors.primary }} />
          Upload Media
        </div>

        <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
          <button type="button" onClick={() => setShowPhotoUploadModal(true)} style={uploadTile(colors.primary, uploading)}>
            <Camera size={32} />
            Upload Photos
          </button>

          <button
            type="button"
            onClick={() => {
              if (videoUploadLocked) return;
              setShowVideoUploadModal(true);
            }}
            style={{
              ...uploadTile(colors.secondary, uploading),
              cursor: videoUploadLocked || uploading ? "not-allowed" : "pointer",
              opacity: videoUploadLocked ? 0.45 : 1,
              filter: videoUploadLocked ? "grayscale(1)" : "none",
            }}
            title={videoUploadLocked ? "Upgrade to Premium to upload videos." : undefined}
          >
            <Video size={32} />
            Upload Videos
          </button>
        </div>
      </div>

      <Section title={`Photos (${photos.length})`} icon={<Camera size={20} style={{ color: colors.primary }} />}>
        <Grid>
          {photos.map((item) => (
            <Card key={item.id} item={item} colors={colors} onClick={() => setViewingMedia(item)} />
          ))}
        </Grid>
      </Section>

      <Section title={`Videos (${videos.length})`} icon={<Video size={20} style={{ color: colors.warning }} />}>
        <Grid>
          {videos.map((item) => (
            <Card key={item.id} item={item} colors={colors} onClick={() => setViewingMedia(item)} />
          ))}
        </Grid>
      </Section>

      {/* ─── Comment Moderation (Post-Centric) ─── */}
      <div
        style={{
          background: "rgba(255,255,255,0.03)",
          backdropFilter: "blur(20px)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: "16px",
          padding: "2rem",
          marginBottom: "2rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1.25rem" }}>
          <MessageSquare size={18} style={{ color: colors.accent }} />
          <div style={{ fontSize: "1.1rem", fontWeight: 900 }}>
            Comment Moderation
            {totalCommentCount > 0 && (
              <span style={{ fontSize: "0.8rem", fontWeight: 600, color: colors.accent, marginLeft: 8 }}>
                ({totalCommentCount} total)
              </span>
            )}
          </div>
        </div>

        <div style={{ fontSize: "0.8rem", color: "rgba(255,255,255,0.4)", marginBottom: "1rem" }}>
          Click a post to view and manage its comments.
        </div>

        {commentPostsLoading ? (
          <div style={{ padding: "2rem", textAlign: "center", color: "rgba(255,255,255,0.5)", fontSize: "0.9rem" }}>
            Loading...
          </div>
        ) : commentPosts.length === 0 ? (
          <div style={{ padding: "2rem", textAlign: "center", color: "rgba(255,255,255,0.4)", fontSize: "0.9rem" }}>
            No comments on your posts yet
          </div>
        ) : (
          <div style={{ display: "grid", gap: "0.5rem" }}>
            {commentPosts.map((post) => (
              <div key={post.id}>
                {/* Post row — clickable */}
                <button
                  type="button"
                  onClick={() => handleExpandPost(post.id)}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.75rem",
                    padding: "0.75rem 1rem",
                    background: expandedPostId === post.id ? "rgba(6,182,212,0.08)" : "rgba(255,255,255,0.02)",
                    borderRadius: expandedPostId === post.id ? "10px 10px 0 0" : "10px",
                    border: expandedPostId === post.id ? `1px solid ${colors.accent}30` : "1px solid rgba(255,255,255,0.05)",
                    cursor: "pointer",
                    textAlign: "left",
                    color: "white",
                    fontFamily: "inherit",
                  }}
                >
                  {/* Thumbnail */}
                  <div
                    style={{
                      width: 56,
                      height: 56,
                      borderRadius: 8,
                      overflow: "hidden",
                      background: "rgba(0,0,0,0.3)",
                      flexShrink: 0,
                      position: "relative",
                    }}
                  >
                    {post.mediaType === "video" ? (
                      <>
                        <video
                          src={post.mediaUrl}
                          style={{ width: "100%", height: "100%", objectFit: "cover" }}
                          muted
                          preload="metadata"
                        />
                        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.3)" }}>
                          <Video size={16} style={{ color: "#fff" }} />
                        </div>
                      </>
                    ) : (
                      <img
                        src={post.mediaUrl}
                        alt={post.caption || "Post"}
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      />
                    )}
                  </div>

                  {/* Post info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 900, fontSize: "0.875rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {post.caption || "Untitled post"}
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.5)", marginTop: 2 }}>
                      by {post.submitter.name} {"\u2022"} {new Date(post.createdAt).toLocaleDateString()}
                    </div>
                  </div>

                  {/* Comment count badge */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.35rem",
                      padding: "0.35rem 0.75rem",
                      background: `${colors.accent}15`,
                      border: `1px solid ${colors.accent}30`,
                      borderRadius: 50,
                      fontSize: "0.8rem",
                      fontWeight: 900,
                      color: colors.accent,
                      flexShrink: 0,
                    }}
                  >
                    <MessageSquare size={13} />
                    {post.commentCount}
                  </div>

                  {/* Expand indicator */}
                  <span style={{ fontSize: "0.9rem", color: "rgba(255,255,255,0.3)", flexShrink: 0 }}>
                    {expandedPostId === post.id ? "\u25B2" : "\u25BC"}
                  </span>
                </button>

                {/* Expanded comments panel */}
                {expandedPostId === post.id && (
                  <div
                    style={{
                      background: "rgba(6,182,212,0.04)",
                      border: `1px solid ${colors.accent}30`,
                      borderTop: "none",
                      borderRadius: "0 0 10px 10px",
                      padding: "0.75rem 1rem",
                    }}
                  >
                    {/* Search bar — always visible when expanded */}
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.625rem" }}>
                      <input
                        type="text"
                        placeholder="Search comments by text or username..."
                        value={commentSearch}
                        onChange={(e) => handleCommentSearchChange(e.target.value, post.id)}
                        style={{
                          flex: 1,
                          padding: "0.5rem 0.75rem",
                          background: "rgba(255,255,255,0.05)",
                          border: "1px solid rgba(255,255,255,0.1)",
                          borderRadius: "8px",
                          color: "white",
                          fontSize: "0.8rem",
                          fontFamily: "inherit",
                          outline: "none",
                        }}
                      />
                      {commentSearch && (
                        <button
                          type="button"
                          onClick={() => { setCommentSearch(""); fetchPostComments(post.id, 1, ""); }}
                          style={{
                            background: "rgba(255,255,255,0.08)",
                            border: "none",
                            borderRadius: "6px",
                            padding: "0.4rem 0.6rem",
                            color: "rgba(255,255,255,0.6)",
                            fontSize: "0.75rem",
                            cursor: "pointer",
                            flexShrink: 0,
                          }}
                        >
                          Clear
                        </button>
                      )}
                    </div>

                    {expandedCommentsLoading ? (
                      <div style={{ padding: "1rem", textAlign: "center", color: "rgba(255,255,255,0.5)", fontSize: "0.85rem" }}>
                        {commentSearch ? "Searching..." : "Loading comments..."}
                      </div>
                    ) : expandedComments.length === 0 ? (
                      <div style={{ padding: "1rem", textAlign: "center", color: "rgba(255,255,255,0.4)", fontSize: "0.85rem" }}>
                        {commentSearch ? `No comments matching "${commentSearch}"` : "No comments"}
                      </div>
                    ) : (
                      <>
                        {/* Result count */}
                        <div style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.4)", marginBottom: "0.5rem" }}>
                          {commentSearch ? `${expandedCommentsTotalRows} result${expandedCommentsTotalRows !== 1 ? "s" : ""}` : (
                            expandedCommentsTotalRows > 20
                              ? `Showing ${(expandedCommentsPage - 1) * 20 + 1}\u2013${Math.min(expandedCommentsPage * 20, expandedCommentsTotalRows)} of ${expandedCommentsTotalRows}`
                              : `${expandedCommentsTotalRows} comment${expandedCommentsTotalRows !== 1 ? "s" : ""}`
                          )}
                        </div>

                        <div style={{ display: "grid", gap: "0.4rem" }}>
                          {expandedComments.map((c) => (
                            <div
                              key={c.id}
                              style={{
                                display: "flex",
                                alignItems: "flex-start",
                                gap: "0.6rem",
                                padding: "0.625rem 0.75rem",
                                background: "rgba(255,255,255,0.02)",
                                borderRadius: "8px",
                                border: "1px solid rgba(255,255,255,0.04)",
                              }}
                            >
                              {/* Avatar */}
                              <div
                                style={{
                                  width: 30,
                                  height: 30,
                                  borderRadius: "50%",
                                  background: `${colors.accent}20`,
                                  border: `1px solid ${colors.accent}40`,
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  flexShrink: 0,
                                  fontSize: "0.7rem",
                                  fontWeight: 900,
                                  color: colors.accent,
                                  overflow: "hidden",
                                }}
                              >
                                {c.user.avatarUrl ? (
                                  <img
                                    src={c.user.avatarUrl}
                                    alt=""
                                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                                  />
                                ) : (
                                  c.user.name.charAt(0).toUpperCase()
                                )}
                              </div>

                              {/* Comment body */}
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: "flex", alignItems: "baseline", gap: "0.35rem", flexWrap: "wrap" }}>
                                  <span style={{ fontWeight: 900, fontSize: "0.8rem" }}>{c.user.name}</span>
                                  {c.user.username && (
                                    <span style={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.4)" }}>
                                      @{c.user.username}
                                    </span>
                                  )}
                                  <span style={{ fontSize: "0.65rem", color: "rgba(255,255,255,0.3)" }}>
                                    {new Date(c.createdAt).toLocaleDateString()}
                                  </span>
                                </div>
                                <p style={{ margin: "3px 0 0", fontSize: "0.825rem", color: "rgba(255,255,255,0.8)", lineHeight: 1.4, wordBreak: "break-word" }}>
                                  {c.body}
                                </p>
                                {c.likeCount > 0 && (
                                  <div style={{ display: "flex", alignItems: "center", gap: "0.2rem", marginTop: 3, fontSize: "0.7rem", color: "rgba(255,255,255,0.4)" }}>
                                    <Heart size={11} /> {c.likeCount}
                                  </div>
                                )}
                              </div>

                              {/* Delete */}
                              <button
                                type="button"
                                onClick={() => handleDeleteComment(c.id, post.id)}
                                disabled={commentDeleteLoading === c.id}
                                style={{
                                  ...pillBtn(`${colors.danger}15`, colors.danger),
                                  padding: "0.3rem 0.6rem",
                                  fontSize: "0.75rem",
                                  opacity: commentDeleteLoading === c.id ? 0.5 : 1,
                                  flexShrink: 0,
                                }}
                                title="Delete this comment"
                              >
                                <Trash2 size={12} /> Delete
                              </button>
                            </div>
                          ))}
                        </div>

                        {/* Pagination */}
                        {expandedCommentsTotalPages > 1 && (
                          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "0.6rem", marginTop: "0.75rem" }}>
                            <button
                              type="button"
                              disabled={expandedCommentsPage <= 1 || expandedCommentsLoading}
                              onClick={() => fetchPostComments(post.id, expandedCommentsPage - 1, commentSearch.trim())}
                              style={{
                                ...pillBtn("rgba(255,255,255,0.05)", "rgba(255,255,255,0.6)"),
                                padding: "0.3rem 0.75rem",
                                fontSize: "0.75rem",
                                opacity: expandedCommentsPage <= 1 ? 0.4 : 1,
                                cursor: expandedCommentsPage <= 1 ? "not-allowed" : "pointer",
                              }}
                            >
                              Prev
                            </button>
                            <span style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.5)" }}>
                              {expandedCommentsPage} / {expandedCommentsTotalPages}
                            </span>
                            <button
                              type="button"
                              disabled={expandedCommentsPage >= expandedCommentsTotalPages || expandedCommentsLoading}
                              onClick={() => fetchPostComments(post.id, expandedCommentsPage + 1, commentSearch.trim())}
                              style={{
                                ...pillBtn("rgba(255,255,255,0.05)", "rgba(255,255,255,0.6)"),
                                padding: "0.3rem 0.75rem",
                                fontSize: "0.75rem",
                                opacity: expandedCommentsPage >= expandedCommentsTotalPages ? 0.4 : 1,
                                cursor: expandedCommentsPage >= expandedCommentsTotalPages ? "not-allowed" : "pointer",
                              }}
                            >
                              Next
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Photo Upload Modal */}
      {showPhotoUploadModal && (
        <ModalOverlay>
          <div style={modalCard()} onClick={(e) => e.stopPropagation()}>
            <ModalHeader title="Upload Photos" icon={<Camera size={24} style={{ color: colors.primary }} />} onClose={() => { setShowPhotoUploadModal(false); setStagedPhotos([]); }} />

            <div style={{ display: "grid", gap: "1rem" }}>
              <Field label="Select Photos">
                <input ref={photoInputRef} type="file" accept="image/*" multiple style={{ display: "none" }} onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    setStagedPhotos(Array.from(e.target.files));
                  }
                }} />
                <div style={dropzone(uploading)} onClick={() => !uploading && photoInputRef.current?.click()}>
                  <Upload size={32} style={{ color: colors.primary, margin: "0 auto 0.5rem" }} />
                  <div style={{ fontSize: "0.875rem", color: "rgba(255,255,255,0.6)" }}>Click to browse</div>
                  <div style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.4)", marginTop: "0.25rem" }}>JPG, PNG up to 10MB</div>
                </div>
              </Field>

              <div style={{ display: "flex", gap: "0.5rem", alignItems: "flex-start", padding: "0.625rem 0.75rem", background: "rgba(6,182,212,0.08)", border: "1px solid rgba(6,182,212,0.2)", borderRadius: "8px" }}>
                <Camera size={14} style={{ color: "#06b6d4", marginTop: "2px", flexShrink: 0 }} />
                <div style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.6)", lineHeight: 1.4 }}>
                  <strong style={{ color: "rgba(255,255,255,0.8)" }}>Best results:</strong> Portrait photos (1080&times;1920 or 9:16+ ratio) fill the Discovery screen perfectly. Landscape photos will be cropped &mdash; use the Focal Point tool after upload to control what users see.
                </div>
              </div>

              {stagedPhotos.length > 0 && (
                <div>
                  <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "rgba(255,255,255,0.7)", marginBottom: "0.5rem" }}>
                    {stagedPhotos.length} photo{stagedPhotos.length > 1 ? "s" : ""} selected
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {stagedPhotos.map((f, i) => (
                      <div key={i} style={{ position: "relative" }}>
                        <img src={URL.createObjectURL(f)} alt={f.name} style={{ width: 64, height: 64, borderRadius: 8, objectFit: "cover", border: "1px solid rgba(255,255,255,0.1)" }} />
                        <button type="button" onClick={() => setStagedPhotos(prev => prev.filter((_, j) => j !== i))} style={{
                          position: "absolute", top: -4, right: -4, width: 18, height: 18, borderRadius: "50%",
                          background: "rgba(239,68,68,0.9)", border: "none", color: "#fff", cursor: "pointer",
                          fontSize: 10, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center",
                        }}>✕</button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <Field label="Photo Title">
                <input ref={photoTitleRef} type="text" placeholder="Enter a descriptive title..." style={input()} />
              </Field>

              <Field label="Description (Optional)">
                <textarea ref={photoDescRef} placeholder="Add a description..." rows={3} style={textarea()} />
              </Field>
            </div>

            <div style={{ display: "flex", gap: "1rem", marginTop: "1.5rem" }}>
              <button type="button" onClick={() => { setShowPhotoUploadModal(false); setStagedPhotos([]); }} style={btnGhost(uploading)} disabled={uploading}>Cancel</button>
              {stagedPhotos.length === 0 ? (
                <button type="button" onClick={() => photoInputRef.current?.click()} style={btnPrimary(colors.primary, colors.accent, uploading)} disabled={uploading}>
                  Choose Files
                </button>
              ) : (
                <button type="button" onClick={() => {
                  const dt = new DataTransfer();
                  stagedPhotos.forEach(f => dt.items.add(f));
                  uploadFiles("photo", dt.files);
                  setStagedPhotos([]);
                }} style={btnPrimary(colors.primary, colors.accent, uploading)} disabled={uploading}>
                  {uploading ? "Uploading…" : `Upload ${stagedPhotos.length} Photo${stagedPhotos.length > 1 ? "s" : ""}`}
                </button>
              )}
            </div>
          </div>
        </ModalOverlay>
      )}

      {/* Video Upload Modal */}
      {showVideoUploadModal && (
        <ModalOverlay>
          <div style={modalCard()} onClick={(e) => e.stopPropagation()}>
            <ModalHeader title="Upload Video" icon={<Video size={24} style={{ color: colors.secondary }} />} onClose={() => { setShowVideoUploadModal(false); setStagedVideo(null); }} />

            <div style={{ display: "grid", gap: "1rem" }}>
              <Field label="Select Video">
                <input ref={videoInputRef} type="file" accept="video/*" style={{ display: "none" }} onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    setStagedVideo(e.target.files[0]);
                  }
                }} />
                <div style={dropzone(uploading)} onClick={() => !uploading && videoInputRef.current?.click()}>
                  <Upload size={32} style={{ color: colors.secondary, margin: "0 auto 0.5rem" }} />
                  <div style={{ fontSize: "0.875rem", color: "rgba(255,255,255,0.6)" }}>Click to browse</div>
                  <div style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.4)", marginTop: "0.25rem" }}>MP4, MOV up to 100MB</div>
                </div>
              </Field>

              {stagedVideo && (
                <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "0.5rem 0.75rem", background: "rgba(255,255,255,0.04)", borderRadius: 8, border: "1px solid rgba(255,255,255,0.08)" }}>
                  <div style={{ fontSize: 20 }}>🎬</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: "0.8rem", fontWeight: 600, color: "rgba(255,255,255,0.8)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{stagedVideo.name}</div>
                    <div style={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.4)" }}>{(stagedVideo.size / 1024 / 1024).toFixed(1)} MB</div>
                  </div>
                  <button type="button" onClick={() => setStagedVideo(null)} style={{ background: "none", border: "none", color: "rgba(239,68,68,0.8)", cursor: "pointer", fontSize: 14, fontWeight: 700 }}>✕</button>
                </div>
              )}

              <Field label="Video Title">
                <input ref={videoTitleRef} type="text" placeholder="Enter a descriptive title..." style={input()} />
              </Field>

              <Field label="Description (Optional)">
                <textarea ref={videoDescRef} placeholder="Add a description..." rows={3} style={textarea()} />
              </Field>

              <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.875rem", fontWeight: 900, color: "rgba(255,255,255,0.8)" }}>
                <input ref={videoSetActiveRef} type="checkbox" style={{ width: 16, height: 16 }} />
                Set as active video (stored in meta)
              </label>
            </div>

            <div style={{ display: "flex", gap: "1rem", marginTop: "1.5rem" }}>
              <button type="button" onClick={() => { setShowVideoUploadModal(false); setStagedVideo(null); }} style={btnGhost(uploading)} disabled={uploading}>Cancel</button>
              {!stagedVideo ? (
                <button type="button" onClick={() => videoInputRef.current?.click()} style={btnPrimary(colors.secondary, colors.warning, uploading)} disabled={uploading}>
                  Choose File
                </button>
              ) : (
                <button type="button" onClick={() => {
                  const dt = new DataTransfer();
                  dt.items.add(stagedVideo);
                  uploadFiles("video", dt.files);
                  setStagedVideo(null);
                }} style={btnPrimary(colors.secondary, colors.warning, uploading)} disabled={uploading}>
                  {uploading ? "Uploading…" : "Upload Video"}
                </button>
              )}
            </div>
          </div>
        </ModalOverlay>
      )}

      {/* Viewer */}
      {viewingMedia && (
        <ModalOverlay dark>
          <div
            style={{
              position: "relative",
              maxWidth: "90vw",
              maxHeight: "90vh",
              display: "flex",
              flexDirection: "column",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "0.5rem", flex: "0 0 auto" }}>
              <button type="button" onClick={() => { setViewingMedia(null); setEditing(false); setSettingFocal(false); setFocalPreview(null); setNaturalSize(null); }} style={{ background: "rgba(255,255,255,0.15)", border: "none", borderRadius: "50%", width: "36px", height: "36px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "white" }} aria-label="Close" title="Close">
                <X size={20} />
              </button>
            </div>

            {/* Media */}
            <div style={{ flex: "1 1 auto", minHeight: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
              {viewingMedia.url ? (
                viewingMedia.type === "video" ? (
                  <video
                    src={viewingMedia.url}
                    controls
                    autoPlay
                    style={{ maxWidth: "100%", maxHeight: (editing || settingFocal) ? "45vh" : "70vh", borderRadius: "12px", objectFit: "contain", background: "#000" }}
                  />
                ) : settingFocal ? (
                  <FocalPicker
                    src={viewingMedia.url}
                    caption={viewingMedia.caption}
                    focalX={focalPreview?.x ?? viewingMedia.focalX}
                    focalY={focalPreview?.y ?? viewingMedia.focalY}
                    onMove={(x, y) => setFocalPreview({ x, y })}
                  />
                ) : (
                  <img src={viewingMedia.url} alt={viewingMedia.caption} style={{ maxWidth: "100%", maxHeight: "70vh", borderRadius: "12px", objectFit: "contain" }} />
                )
              ) : (
                <div style={{ width: "400px", height: "300px", borderRadius: "12px", background: "rgba(255,255,255,0.05)", display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.3)" }}>No Media</div>
              )}
            </div>

            {/* Bottom area */}
            <div style={{ flex: "0 0 auto", paddingTop: "0.75rem" }}>
              {settingFocal ? (
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: "0.85rem", color: "rgba(255,255,255,0.7)", marginBottom: "0.75rem" }}>
                    Drag the visible area to reposition what users see on Discovery
                  </div>
                  <div style={{ display: "flex", gap: "0.75rem", justifyContent: "center" }}>
                    <button type="button" style={pillBtn("rgba(255,255,255,0.08)", "rgba(255,255,255,0.6)")} onClick={() => { setSettingFocal(false); setFocalPreview(null); setNaturalSize(null); }}>
                      Cancel
                    </button>
                    <button
                      type="button"
                      style={pillBtn(`${colors.success}20`, colors.success)}
                      onClick={() => {
                        const fp = focalPreview ?? { x: viewingMedia.focalX, y: viewingMedia.focalY };
                        saveFocalPoint(viewingMedia, fp.x, fp.y);
                      }}
                      disabled={uploading}
                    >
                      <Save size={14} /> {uploading ? "Saving…" : "Save"}
                    </button>
                  </div>
                </div>
              ) : editing ? (
                <div style={{ maxWidth: 480, marginLeft: "auto", marginRight: "auto" }}>
                  <div style={{ marginBottom: "0.5rem" }}>
                    <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, color: "rgba(255,255,255,0.6)", marginBottom: "0.25rem" }}>Title</label>
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      style={input()}
                      autoFocus
                    />
                  </div>
                  <div style={{ marginBottom: "0.5rem" }}>
                    <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, color: "rgba(255,255,255,0.6)", marginBottom: "0.25rem" }}>Description</label>
                    <textarea
                      value={editDesc}
                      onChange={(e) => setEditDesc(e.target.value)}
                      rows={2}
                      placeholder="Add a description..."
                      style={textarea()}
                    />
                  </div>
                  <div style={{ display: "flex", gap: "0.75rem", justifyContent: "center" }}>
                    <button type="button" style={pillBtn("rgba(255,255,255,0.08)", "rgba(255,255,255,0.6)")} onClick={() => setEditing(false)} disabled={uploading}>
                      Cancel
                    </button>
                    <button type="button" style={pillBtn(`${colors.success}20`, colors.success)} onClick={() => saveMediaEdit(viewingMedia)} disabled={uploading}>
                      <Save size={14} /> {uploading ? "Saving…" : "Save"}
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div style={{ textAlign: "center", color: "white" }}>
                    <div style={{ fontSize: "1.125rem", fontWeight: 900, marginBottom: "0.15rem" }}>{viewingMedia.caption}</div>
                    {viewingMedia.description && (
                      <div style={{ fontSize: "0.85rem", color: "rgba(255,255,255,0.55)" }}>{viewingMedia.description}</div>
                    )}
                  </div>
                  <div style={{ marginTop: "0.75rem", display: "flex", gap: "0.75rem", justifyContent: "center", flexWrap: "wrap" }}>
                    <button type="button" style={pillBtn(`${colors.accent}20`, colors.accent)} onClick={() => { setEditTitle(viewingMedia.caption); setEditDesc(viewingMedia.description); setEditing(true); }} disabled={uploading}>
                      <Pencil size={14} /> Edit
                    </button>
                    {viewingMedia.type === "photo" && (
                      <button type="button" style={pillBtn(`${colors.warning}20`, colors.warning)} onClick={() => { setFocalPreview(null); setSettingFocal(true); }} disabled={uploading}>
                        <Crosshair size={14} /> Focal Point
                      </button>
                    )}
                    {viewingMedia.type === "photo" && !viewingMedia.isMainPhoto && (
                      <button type="button" style={pillBtn(`${colors.primary}20`, colors.primary)} onClick={() => setMainPhoto(viewingMedia)} disabled={uploading}>
                        <Award size={14} /> {uploading ? "Working…" : "Set as Main Photo"}
                      </button>
                    )}
                    <button type="button" style={pillBtn(`${colors.danger}20`, colors.danger)} onClick={() => deleteMedia(viewingMedia)} disabled={uploading}>
                      {uploading ? "Working…" : "Delete"}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </ModalOverlay>
      )}
    </div>
  );

  // ---- UI helpers ----
  function StatCard({
    label,
    value,
    icon,
    color,
    progress,
  }: {
    label: string;
    value: string;
    icon: React.ReactNode;
    color: string;
    progress?: number;
  }) {
    return (
      <div style={{ background: "rgba(255, 255, 255, 0.03)", backdropFilter: "blur(20px)", border: "1px solid rgba(255, 255, 255, 0.08)", borderRadius: "12px", padding: "1.5rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem", color }}>
          {icon}
          <span style={{ fontSize: "0.875rem", color: "rgba(255, 255, 255, 0.6)" }}>{label}</span>
        </div>

        <div style={{ fontSize: "2rem", fontWeight: 900, fontFamily: '"Space Mono", monospace', marginBottom: progress !== undefined ? "0.5rem" : 0 }}>
          {value}
        </div>

        {progress !== undefined && (
          <div style={{ width: "100%", height: "8px", background: "rgba(255, 255, 255, 0.1)", borderRadius: "4px", overflow: "hidden" }}>
            <div style={{ width: `${Math.max(0, Math.min(1, progress)) * 100}%`, height: "100%", background: color }} />
          </div>
        )}
      </div>
    );
  }

  function banner(bg: string, border: string, color: string): React.CSSProperties {
    return { padding: "1rem", marginBottom: "1rem", background: bg, border, borderRadius: "12px", color, fontWeight: 900 };
  }
  function panel(): React.CSSProperties {
    return { background: "rgba(255,255,255,0.03)", backdropFilter: "blur(20px)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "16px", padding: "2rem", marginBottom: "2rem" };
  }
  function panelTitle(): React.CSSProperties {
    return { fontSize: "1.25rem", fontWeight: 900, marginBottom: "1.5rem", display: "flex", alignItems: "center", gap: "0.5rem" };
  }
  function uploadTile(color: string, disabled: boolean): React.CSSProperties {
    return { flex: 1, minWidth: 260, padding: "2rem", background: `${color}10`, border: `2px dashed ${color}40`, borderRadius: "12px", color, fontWeight: 900, cursor: disabled ? "not-allowed" : "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: "0.75rem", opacity: disabled ? 0.7 : 1 };
  }
  function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
    return (
      <div style={panel()}>
        <div style={{ ...panelTitle(), marginBottom: "1.25rem" }}>
          {icon} {title}
        </div>
        {children}
      </div>
    );
  }
  function Grid({ children }: { children: React.ReactNode }) {
    return <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))", gap: "1.5rem" }}>{children}</div>;
  }
  function Card({ item, colors, onClick }: { item: UiMediaItem; colors: Record<string, string>; onClick: () => void }) {
    const isBanned = item.adminStatus === "banned";
    const isInvestigating = item.adminStatus === "investigating";

    return (
      <div
        style={{
          position: "relative",
          borderRadius: "12px",
          overflow: "hidden",
          aspectRatio: "3/2",
          background: "rgba(255,255,255,0.05)",
          cursor: isBanned ? "not-allowed" : "pointer",
          opacity: isBanned ? 0.5 : 1,
          border: isBanned ? "2px solid #ef4444" : isInvestigating ? "2px solid #f59e0b" : "none",
        }}
        onClick={() => !isBanned && onClick()}
      >
        {item.url ? (
          item.type === "video" ? (
            <>
              <video src={item.url} muted preload="metadata" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.25)", pointerEvents: "none" }}>
                <div style={{ width: 48, height: 48, borderRadius: "50%", background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <div style={{ width: 0, height: 0, borderTop: "10px solid transparent", borderBottom: "10px solid transparent", borderLeft: "16px solid white", marginLeft: 3 }} />
                </div>
              </div>
            </>
          ) : (
            <img src={item.url} alt={item.caption} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          )
        ) : (
          <div style={{ width: "100%", height: "100%", background: "rgba(255,255,255,0.05)", display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.3)", fontSize: "0.75rem" }}>No Media</div>
        )}

        {/* Banned overlay */}
        {isBanned && (
          <div style={{
            position: "absolute", inset: 0,
            background: "rgba(0,0,0,0.6)",
            display: "flex", alignItems: "center", justifyContent: "center",
            flexDirection: "column", gap: "0.5rem",
          }}>
            <div style={{
              background: "#ef4444", color: "white",
              padding: "0.5rem 1.25rem", borderRadius: "8px",
              fontSize: "0.9rem", fontWeight: 900,
              display: "flex", alignItems: "center", gap: "0.4rem",
            }}>
              <XCircle size={16} /> Banned
            </div>
            <div style={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.6)", textAlign: "center", padding: "0 1rem" }}>
              This media has been removed by LetsGo staff
            </div>
          </div>
        )}

        {/* Investigating overlay */}
        {isInvestigating && (
          <div style={{
            position: "absolute", top: "0.75rem", left: "0.75rem",
            background: "#f59e0b", color: "#000",
            padding: "0.375rem 0.75rem", borderRadius: "6px",
            fontSize: "0.7rem", fontWeight: 900,
            display: "flex", alignItems: "center", gap: "0.25rem",
          }}>
            <AlertCircle size={12} /> Under Review
          </div>
        )}

        {item.type === "photo" && item.isMainPhoto && !isBanned && !isInvestigating && (
          <div style={{ position: "absolute", top: "0.75rem", left: "0.75rem", background: colors.primary, color: "white", padding: "0.375rem 0.75rem", borderRadius: "6px", fontSize: "0.75rem", fontWeight: 900, display: "flex", alignItems: "center", gap: "0.25rem" }}>
            <Award size={12} /> Main Photo
          </div>
        )}
        {!isBanned && (
          <div style={{ position: "absolute", top: "0.75rem", right: "0.75rem", background: "rgba(0,0,0,0.7)", backdropFilter: "blur(10px)", padding: "0.5rem 0.75rem", borderRadius: "8px", fontSize: "0.75rem", fontWeight: 900, display: "flex", alignItems: "center", gap: "0.5rem", color: item.type === "photo" ? colors.primary : colors.danger }}>
            {item.type === "photo" ? <Bookmark size={14} /> : <Heart size={14} />}
            {item.type === "photo" ? item.saves ?? 0 : item.likes ?? 0}
          </div>
        )}
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "linear-gradient(transparent, rgba(0,0,0,0.9))", padding: "3rem 1rem 1rem" }}>
          <div style={{ fontSize: "0.875rem", fontWeight: 900 }}>{item.caption}</div>
        </div>
      </div>
    );
  }
  function ModalOverlay({ children, dark }: { children: React.ReactNode; dark?: boolean }) {
    return <div style={{ position: "fixed", inset: 0, background: dark ? "rgba(0,0,0,0.95)" : "rgba(0,0,0,0.8)", backdropFilter: "blur(10px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "2rem" }}>{children}</div>;
  }
  function modalCard(): React.CSSProperties {
    return { background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "16px", padding: "2rem", maxWidth: "520px", width: "100%" };
  }
  function input(): React.CSSProperties {
    return { width: "100%", padding: "0.875rem", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", color: "white", fontSize: "0.875rem", fontFamily: "inherit" };
  }
  function textarea(): React.CSSProperties {
    return { ...input(), resize: "vertical" as const };
  }
  function dropzone(disabled: boolean): React.CSSProperties {
    return { padding: "2rem", background: "rgba(255,255,255,0.05)", border: "2px dashed rgba(255,255,255,0.2)", borderRadius: "8px", textAlign: "center", cursor: disabled ? "not-allowed" : "pointer", userSelect: "none" };
  }
  function btnGhost(disabled: boolean): React.CSSProperties {
    return { flex: 1, padding: "0.875rem", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: "8px", color: "white", fontSize: "0.875rem", fontWeight: 900, cursor: disabled ? "not-allowed" : "pointer" };
  }
  function btnPrimary(from: string, to: string, disabled: boolean): React.CSSProperties {
    return { flex: 1, padding: "0.875rem", background: `linear-gradient(135deg, ${from} 0%, ${to} 100%)`, border: "none", borderRadius: "8px", color: "white", fontSize: "0.875rem", fontWeight: 950, cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.7 : 1 };
  }
  function pillBtn(bg: string, color: string): React.CSSProperties {
    return { padding: "0.55rem 1rem", background: bg, border: `1px solid ${color}`, borderRadius: "8px", color, fontSize: "0.875rem", fontWeight: 900, cursor: "pointer", display: "flex", alignItems: "center", gap: "0.4rem" };
  }
  function closeCircle(): React.CSSProperties {
    return { position: "absolute", top: "-50px", right: "0", background: "rgba(255,255,255,0.1)", border: "none", borderRadius: "50%", width: "40px", height: "40px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "white" };
  }
  function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
      <div>
        <label style={{ display: "block", fontSize: "0.875rem", fontWeight: 900, marginBottom: "0.5rem", color: "rgba(255,255,255,0.7)" }}>{label}</label>
        {children}
      </div>
    );
  }
  function ModalHeader({ title, icon, onClose }: { title: string; icon: React.ReactNode; onClose: () => void }) {
    return (
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          {icon}
          <div style={{ fontSize: "1.5rem", fontWeight: 950 }}>{title}</div>
        </div>
        <button type="button" onClick={onClose} style={{ background: "rgba(255,255,255,0.1)", border: "none", borderRadius: "8px", width: "40px", height: "40px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "white" }} aria-label="Close" title="Close">
          <X size={20} />
        </button>
      </div>
    );
  }
}