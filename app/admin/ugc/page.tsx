"use client";

import React, { useEffect, useState, useCallback } from "react";
import {
  COLORS,
  Badge,
  Card,
  StatCard,
  SectionTitle,
  formatDateTime,
} from "@/components/admin/components";
import { logAudit, AUDIT_TABS } from "@/lib/auditLog";
import { supabaseBrowser } from "@/lib/supabaseBrowser";

// ─── Types ───

interface UgcSubmission {
  id: string;
  mediaType: "image" | "video";
  mediaUrl: string;
  caption: string | null;
  tags: string[];
  status: string;
  isActive: boolean;
  reviewedBy: string | null;
  createdAt: string;
  businessId: string;
  businessName: string;
  user: {
    id: string;
    name: string;
    username: string | null;
  };
}

interface UgcStats {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
}

interface UgcComment {
  id: string;
  experienceId: string;
  body: string;
  createdAt: string;
  likeCount: number;
  user: {
    id: string;
    name: string;
    username: string | null;
  };
}

interface CommentPost {
  id: string;
  mediaType: string;
  mediaUrl: string;
  caption: string | null;
  status: string;
  createdAt: string;
  commentCount: number;
  businessId: string;
  businessName: string;
  submitter: {
    id: string;
    name: string;
    username: string | null;
  };
}

interface Pagination {
  page: number;
  limit: number;
  totalRows: number;
  totalPages: number;
}

type StatusFilter = "all" | "pending" | "approved" | "rejected";
type MainTab = "media" | "comments";

// ─── Helpers ───

const STATUS_TABS: { key: StatusFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
];

const btnStyle = (active: boolean): React.CSSProperties => ({
  padding: "8px 16px",
  borderRadius: 8,
  border: active ? "1px solid " + COLORS.neonBlue : "1px solid " + COLORS.cardBorder,
  background: active ? "rgba(0,212,255,0.15)" : "transparent",
  color: active ? COLORS.neonBlue : COLORS.textSecondary,
  cursor: "pointer",
  fontSize: 13,
  fontWeight: 600,
  transition: "all 0.2s",
});

const actionBtn = (color: string): React.CSSProperties => ({
  padding: "6px 12px",
  borderRadius: 6,
  border: "1px solid " + color,
  background: "transparent",
  color,
  cursor: "pointer",
  fontSize: 11,
  fontWeight: 600,
  transition: "all 0.2s",
});

const mainTabStyle = (active: boolean): React.CSSProperties => ({
  padding: "12px 24px",
  borderRadius: 10,
  border: "none",
  background: active ? COLORS.gradient1 : "transparent",
  color: active ? "#fff" : COLORS.textSecondary,
  cursor: "pointer",
  fontSize: 14,
  fontWeight: 700,
  transition: "all 0.2s",
});

// ═══════════════════════════════════════════════════
// Admin UGC Moderation Page
// ═══════════════════════════════════════════════════

export default function AdminUgcPage() {
  // ── Main tab ──
  const [mainTab, setMainTab] = useState<MainTab>("media");

  // ── Media state ──
  const [submissions, setSubmissions] = useState<UgcSubmission[]>([]);
  const [stats, setStats] = useState<UgcStats>({ total: 0, pending: 0, approved: 0, rejected: 0 });
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, totalRows: 0, totalPages: 0 });
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewType, setPreviewType] = useState<"image" | "video">("image");

  // ── Comments state (post-centric) ──
  const [commentPosts, setCommentPosts] = useState<CommentPost[]>([]);
  const [commentPostsLoading, setCommentPostsLoading] = useState(false);
  const [totalCommentCount, setTotalCommentCount] = useState(0);
  const [commentPostSearch, setCommentPostSearch] = useState("");
  const [expandedPostId, setExpandedPostId] = useState<string | null>(null);
  const [expandedComments, setExpandedComments] = useState<UgcComment[]>([]);
  const [expandedCommentsLoading, setExpandedCommentsLoading] = useState(false);
  const [expandedPage, setExpandedPage] = useState(1);
  const [expandedTotalPages, setExpandedTotalPages] = useState(0);
  const [expandedTotalRows, setExpandedTotalRows] = useState(0);
  const [perPostSearch, setPerPostSearch] = useState("");
  const perPostSearchTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const [commentActionLoading, setCommentActionLoading] = useState<string | null>(null);

  // Helper to get auth headers
  const getAuthHeaders = async (): Promise<Record<string, string>> => {
    const { data: { session } } = await supabaseBrowser.auth.getSession();
    return { Authorization: `Bearer ${session?.access_token || ""}` };
  };

  // ── Media data fetch ──
  const fetchMedia = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        status: statusFilter,
        page: String(page),
        limit: "20",
      });
      if (search) params.set("search", search);

      const auth = await getAuthHeaders();
      const res = await fetch(`/api/admin/ugc?${params}`, { headers: auth });
      const json = await res.json();

      if (json.error) {
        console.error("[admin/ugc] fetch error:", json.error);
        return;
      }

      setSubmissions(json.submissions ?? []);
      setStats(json.stats ?? { total: 0, pending: 0, approved: 0, rejected: 0 });
      setPagination(json.pagination ?? { page: 1, limit: 20, totalRows: 0, totalPages: 0 });
    } catch (err) {
      console.error("[admin/ugc] fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, search]);

  // ── Fetch posts with comment counts ──
  const fetchCommentPosts = useCallback(async () => {
    setCommentPostsLoading(true);
    try {
      const params = new URLSearchParams({ mode: "posts" });
      if (commentPostSearch) params.set("search", commentPostSearch);

      const auth = await getAuthHeaders();
      const res = await fetch(`/api/admin/ugc/comments?${params}`, { headers: auth });
      const json = await res.json();

      if (json.error) {
        console.error("[admin/ugc/comments] posts error:", json.error);
        return;
      }

      setCommentPosts(json.posts ?? []);
      setTotalCommentCount(json.totalComments ?? 0);
    } catch (err) {
      console.error("[admin/ugc/comments] posts error:", err);
    } finally {
      setCommentPostsLoading(false);
    }
  }, [commentPostSearch]);

  // ── Fetch comments for a specific post ──
  const fetchPostComments = useCallback(async (expId: string, pg = 1, search = "") => {
    setExpandedCommentsLoading(true);
    try {
      const params = new URLSearchParams({
        experienceId: expId,
        page: String(pg),
        limit: "20",
      });
      if (search) params.set("search", search);

      const auth = await getAuthHeaders();
      const res = await fetch(`/api/admin/ugc/comments?${params}`, { headers: auth });
      const json = await res.json();

      if (json.error) {
        console.error("[admin/ugc/comments] fetch error:", json.error);
        return;
      }

      setExpandedComments(json.comments ?? []);
      setExpandedPage(json.pagination?.page ?? pg);
      setExpandedTotalPages(json.pagination?.totalPages ?? 0);
      setExpandedTotalRows(json.pagination?.totalRows ?? 0);
    } catch (err) {
      console.error("[admin/ugc/comments] fetch error:", err);
    } finally {
      setExpandedCommentsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (mainTab === "media") {
      fetchMedia(1);
    } else {
      fetchCommentPosts();
    }
  }, [mainTab, fetchMedia, fetchCommentPosts]);

  function handleExpandAdminPost(postId: string) {
    if (expandedPostId === postId) {
      setExpandedPostId(null);
      setExpandedComments([]);
      setPerPostSearch("");
    } else {
      setExpandedPostId(postId);
      setExpandedPage(1);
      setPerPostSearch("");
      fetchPostComments(postId, 1, "");
    }
  }

  function handlePerPostSearchChange(value: string, postId: string) {
    setPerPostSearch(value);
    if (perPostSearchTimer.current) clearTimeout(perPostSearchTimer.current);
    perPostSearchTimer.current = setTimeout(() => {
      setExpandedPage(1);
      fetchPostComments(postId, 1, value.trim());
    }, 400);
  }

  // ── Media moderation actions ──
  async function handleMediaAction(submissionId: string, action: "approve" | "reject" | "delete") {
    setActionLoading(submissionId);
    try {
      const auth = await getAuthHeaders();
      const res = await fetch("/api/admin/ugc", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...auth },
        body: JSON.stringify({ submissionId, action }),
      });
      const json = await res.json();
      if (json.error) {
        console.error("[admin/ugc] action error:", json.error);
        return;
      }
      const sub = submissions.find(s => s.id === submissionId);
      logAudit({
        action: `${action}_media`,
        tab: AUDIT_TABS.UGC,
        subTab: "Media",
        targetType: "media_submission",
        targetId: submissionId,
        entityName: sub?.businessName,
        details: `${action.charAt(0).toUpperCase() + action.slice(1)}d ${sub?.mediaType || "media"} by ${sub?.user.name || "unknown"}`,
      });
      await fetchMedia(pagination.page);
    } catch (err) {
      console.error("[admin/ugc] action error:", err);
    } finally {
      setActionLoading(null);
    }
  }

  // ── Comment delete action ──
  async function handleDeleteComment(commentId: string, experienceId: string) {
    setCommentActionLoading(commentId);
    try {
      const auth = await getAuthHeaders();
      const res = await fetch("/api/admin/ugc/comments", {
        method: "DELETE",
        headers: { "Content-Type": "application/json", ...auth },
        body: JSON.stringify({ commentId }),
      });
      const json = await res.json();
      if (json.error) {
        console.error("[admin/ugc/comments] delete error:", json.error);
        return;
      }
      const comment = expandedComments.find(c => c.id === commentId);
      logAudit({
        action: "delete_comment",
        tab: AUDIT_TABS.UGC,
        subTab: "Comments",
        targetType: "comment",
        targetId: commentId,
        entityName: comment?.user.name,
        details: `Deleted comment: "${comment?.body.substring(0, 80) || ""}..."`,
      });
      // Update local state
      setExpandedComments((prev) => prev.filter((c) => c.id !== commentId));
      setCommentPosts((prev) =>
        prev.map((p) =>
          p.id === experienceId ? { ...p, commentCount: Math.max(0, p.commentCount - 1) } : p
        ).filter((p) => p.commentCount > 0)
      );
      setTotalCommentCount((prev) => Math.max(0, prev - 1));
      setExpandedTotalRows((prev) => Math.max(0, prev - 1));
    } catch (err) {
      console.error("[admin/ugc/comments] delete error:", err);
    } finally {
      setCommentActionLoading(null);
    }
  }

  // ═══════════════════════════════════════════════════
  // Render
  // ═══════════════════════════════════════════════════

  return (
    <div style={{ maxWidth: 1400, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0 }}>
          User Content Moderation
        </h1>
        <p style={{ color: COLORS.textSecondary, fontSize: 14, marginTop: 4 }}>
          Review and moderate user-generated photos, videos, and comments
        </p>
      </div>

      {/* Main Tab Switcher */}
      <div style={{
        display: "flex",
        gap: 4,
        marginBottom: 24,
        padding: 4,
        background: COLORS.cardBg,
        borderRadius: 12,
        border: "1px solid " + COLORS.cardBorder,
        width: "fit-content",
      }}>
        <button onClick={() => setMainTab("media")} style={mainTabStyle(mainTab === "media")}>
          Media Submissions
        </button>
        <button onClick={() => setMainTab("comments")} style={mainTabStyle(mainTab === "comments")}>
          Comments
          {totalCommentCount > 0 && (
            <span style={{
              marginLeft: 8,
              padding: "2px 8px",
              borderRadius: 10,
              fontSize: 11,
              fontWeight: 700,
              background: mainTab === "comments" ? "rgba(255,255,255,0.2)" : COLORS.cardBorder,
              color: mainTab === "comments" ? "#fff" : COLORS.textSecondary,
            }}>
              {totalCommentCount}
            </span>
          )}
        </button>
      </div>

      {/* ═══════════════════════════════════════════ */}
      {/* MEDIA TAB                                  */}
      {/* ═══════════════════════════════════════════ */}
      {mainTab === "media" && (
        <>
          {/* Stats Row */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 32 }}>
            <StatCard value={stats.total} label="Total Submissions" gradient={COLORS.gradient1} icon="📸" />
            <StatCard value={stats.pending} label="Pending Review" gradient={COLORS.gradient4} icon="⏳" />
            <StatCard value={stats.approved} label="Approved" gradient={COLORS.gradient2} icon="✅" />
            <StatCard value={stats.rejected} label="Rejected" gradient="linear-gradient(135deg, #ff3131, #990000)" icon="❌" />
          </div>

          <SectionTitle icon="🔍">Submissions</SectionTitle>

          <Card>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16, alignItems: "center" }}>
              {STATUS_TABS.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setStatusFilter(tab.key)}
                  style={btnStyle(statusFilter === tab.key)}
                >
                  {tab.label}
                  {tab.key === "pending" && stats.pending > 0 && (
                    <span style={{
                      marginLeft: 6,
                      padding: "2px 6px",
                      borderRadius: 10,
                      fontSize: 10,
                      fontWeight: 700,
                      background: COLORS.neonOrange,
                      color: "#000",
                    }}>
                      {stats.pending}
                    </span>
                  )}
                </button>
              ))}
              <div style={{ flex: 1 }} />
              <input
                type="text"
                placeholder="Search by business name..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{
                  padding: "8px 14px",
                  borderRadius: 8,
                  border: "1px solid " + COLORS.cardBorder,
                  background: COLORS.darkBg,
                  color: COLORS.textPrimary,
                  fontSize: 13,
                  width: 240,
                }}
              />
            </div>

            {loading && (
              <div style={{ textAlign: "center", padding: 40, color: COLORS.textSecondary }}>
                Loading submissions...
              </div>
            )}

            {!loading && submissions.length === 0 && (
              <div style={{ textAlign: "center", padding: 40, color: COLORS.textSecondary }}>
                No submissions found
                {statusFilter !== "all" && ` with status "${statusFilter}"`}
                {search && ` matching "${search}"`}
              </div>
            )}

            {!loading && submissions.length > 0 && (
              <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
                gap: 16,
              }}>
                {submissions.map((s) => (
                  <div
                    key={s.id}
                    style={{
                      background: COLORS.darkBg,
                      border: "1px solid " + COLORS.cardBorder,
                      borderRadius: 12,
                      overflow: "hidden",
                      transition: "border-color 0.2s",
                    }}
                  >
                    {/* Media thumbnail */}
                    <div
                      style={{
                        position: "relative",
                        width: "100%",
                        height: 200,
                        background: "#111",
                        cursor: "pointer",
                      }}
                      onClick={() => {
                        setPreviewUrl(s.mediaUrl);
                        setPreviewType(s.mediaType);
                      }}
                    >
                      {s.mediaType === "video" ? (
                        <video
                          src={s.mediaUrl}
                          style={{ width: "100%", height: "100%", objectFit: "cover" }}
                          muted
                        />
                      ) : (
                        <img
                          src={s.mediaUrl}
                          alt="UGC submission"
                          style={{ width: "100%", height: "100%", objectFit: "cover" }}
                        />
                      )}
                      <div style={{
                        position: "absolute",
                        top: 8,
                        left: 8,
                        padding: "3px 8px",
                        borderRadius: 6,
                        background: "rgba(0,0,0,0.7)",
                        color: "#fff",
                        fontSize: 10,
                        fontWeight: 600,
                        textTransform: "uppercase",
                      }}>
                        {s.mediaType}
                      </div>
                      {!s.isActive && (
                        <div style={{
                          position: "absolute",
                          top: 8,
                          right: 8,
                          padding: "3px 8px",
                          borderRadius: 6,
                          background: "rgba(255,49,49,0.8)",
                          color: "#fff",
                          fontSize: 10,
                          fontWeight: 600,
                        }}>
                          DELETED
                        </div>
                      )}
                    </div>

                    <div style={{ padding: 14 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                        <Badge status={s.status} />
                        <span style={{ fontSize: 11, color: COLORS.textSecondary }}>
                          {formatDateTime(s.createdAt)}
                        </span>
                      </div>

                      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>
                        {s.businessName}
                      </div>

                      <div style={{ fontSize: 12, color: COLORS.textSecondary, marginBottom: 6 }}>
                        By: {s.user.name}
                        {s.user.username && (
                          <span style={{ color: COLORS.neonBlue }}> @{s.user.username}</span>
                        )}
                      </div>

                      {s.caption && (
                        <div style={{
                          fontSize: 12,
                          color: COLORS.textSecondary,
                          marginBottom: 6,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}>
                          {s.caption}
                        </div>
                      )}

                      {s.tags.length > 0 && (
                        <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 8 }}>
                          {s.tags.slice(0, 4).map((t) => (
                            <span
                              key={t}
                              style={{
                                padding: "2px 8px",
                                borderRadius: 10,
                                background: "rgba(191,95,255,0.15)",
                                color: COLORS.neonPurple,
                                fontSize: 10,
                                fontWeight: 600,
                              }}
                            >
                              #{t}
                            </span>
                          ))}
                        </div>
                      )}

                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
                        {s.status === "pending" && (
                          <>
                            <button
                              onClick={() => handleMediaAction(s.id, "approve")}
                              disabled={actionLoading === s.id}
                              style={actionBtn(COLORS.neonGreen)}
                            >
                              {actionLoading === s.id ? "..." : "Approve"}
                            </button>
                            <button
                              onClick={() => handleMediaAction(s.id, "reject")}
                              disabled={actionLoading === s.id}
                              style={actionBtn(COLORS.neonRed)}
                            >
                              {actionLoading === s.id ? "..." : "Reject"}
                            </button>
                          </>
                        )}
                        {s.status === "approved" && (
                          <button
                            onClick={() => handleMediaAction(s.id, "reject")}
                            disabled={actionLoading === s.id}
                            style={actionBtn(COLORS.neonRed)}
                          >
                            {actionLoading === s.id ? "..." : "Reject"}
                          </button>
                        )}
                        {s.status === "rejected" && (
                          <button
                            onClick={() => handleMediaAction(s.id, "approve")}
                            disabled={actionLoading === s.id}
                            style={actionBtn(COLORS.neonGreen)}
                          >
                            {actionLoading === s.id ? "..." : "Approve"}
                          </button>
                        )}
                        {s.isActive && (
                          <button
                            onClick={() => handleMediaAction(s.id, "delete")}
                            disabled={actionLoading === s.id}
                            style={actionBtn(COLORS.neonOrange)}
                          >
                            {actionLoading === s.id ? "..." : "Delete"}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Media Pagination */}
            {pagination.totalPages > 1 && (
              <div style={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                gap: 12,
                marginTop: 24,
                paddingTop: 16,
                borderTop: "1px solid " + COLORS.cardBorder,
              }}>
                <button
                  onClick={() => fetchMedia(pagination.page - 1)}
                  disabled={pagination.page <= 1 || loading}
                  style={{
                    ...btnStyle(false),
                    opacity: pagination.page <= 1 ? 0.4 : 1,
                    cursor: pagination.page <= 1 ? "not-allowed" : "pointer",
                  }}
                >
                  Previous
                </button>
                <span style={{ fontSize: 13, color: COLORS.textSecondary }}>
                  Page {pagination.page} of {pagination.totalPages}
                </span>
                <button
                  onClick={() => fetchMedia(pagination.page + 1)}
                  disabled={pagination.page >= pagination.totalPages || loading}
                  style={{
                    ...btnStyle(false),
                    opacity: pagination.page >= pagination.totalPages ? 0.4 : 1,
                    cursor: pagination.page >= pagination.totalPages ? "not-allowed" : "pointer",
                  }}
                >
                  Next
                </button>
              </div>
            )}
          </Card>
        </>
      )}

      {/* ═══════════════════════════════════════════ */}
      {/* COMMENTS TAB (post-centric)                */}
      {/* ═══════════════════════════════════════════ */}
      {mainTab === "comments" && (
        <>
          {/* Stats Row */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 32 }}>
            <StatCard value={totalCommentCount} label="Total Comments" gradient={COLORS.gradient3} icon="💬" />
            <StatCard value={commentPosts.length} label="Posts with Comments" gradient={COLORS.gradient1} icon="📸" />
          </div>

          <SectionTitle icon="💬">Comment Moderation</SectionTitle>

          <Card>
            <div style={{ fontSize: 13, color: COLORS.textSecondary, marginBottom: 16 }}>
              Click a post to view and manage its comments. Use the search bar inside each post to find specific comments.
            </div>

            {/* Filter posts by business/submitter */}
            <div style={{ display: "flex", gap: 8, marginBottom: 16, alignItems: "center" }}>
              <input
                type="text"
                placeholder="Filter by business or submitter name..."
                value={commentPostSearch}
                onChange={(e) => setCommentPostSearch(e.target.value)}
                style={{
                  padding: "8px 14px",
                  borderRadius: 8,
                  border: "1px solid " + COLORS.cardBorder,
                  background: COLORS.darkBg,
                  color: COLORS.textPrimary,
                  fontSize: 13,
                  width: 360,
                }}
              />
              {commentPostSearch && (
                <button
                  onClick={() => setCommentPostSearch("")}
                  style={actionBtn(COLORS.textSecondary)}
                >
                  Clear
                </button>
              )}
            </div>

            {commentPostsLoading && (
              <div style={{ textAlign: "center", padding: 40, color: COLORS.textSecondary }}>
                Loading...
              </div>
            )}

            {!commentPostsLoading && commentPosts.length === 0 && (
              <div style={{ textAlign: "center", padding: 40, color: COLORS.textSecondary }}>
                No posts with comments found{commentPostSearch && ` matching "${commentPostSearch}"`}
              </div>
            )}

            {/* Posts list */}
            {!commentPostsLoading && commentPosts.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {commentPosts.map((post) => (
                  <div key={post.id}>
                    {/* Post row — clickable */}
                    <button
                      type="button"
                      onClick={() => handleExpandAdminPost(post.id)}
                      style={{
                        width: "100%",
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        padding: "10px 14px",
                        background: expandedPostId === post.id ? "rgba(0,212,255,0.08)" : COLORS.darkBg,
                        borderRadius: expandedPostId === post.id ? "10px 10px 0 0" : 10,
                        border: expandedPostId === post.id
                          ? "1px solid rgba(0,212,255,0.25)"
                          : "1px solid " + COLORS.cardBorder,
                        cursor: "pointer",
                        textAlign: "left",
                        color: COLORS.textPrimary,
                        fontFamily: "inherit",
                        transition: "all 0.15s",
                      }}
                    >
                      {/* Thumbnail */}
                      <div style={{
                        width: 52,
                        height: 52,
                        borderRadius: 8,
                        overflow: "hidden",
                        background: "#111",
                        flexShrink: 0,
                        position: "relative",
                      }}>
                        {post.mediaType === "video" ? (
                          <>
                            <video src={post.mediaUrl} style={{ width: "100%", height: "100%", objectFit: "cover" }} muted preload="metadata" />
                            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.3)", fontSize: 16 }}>
                              ▶
                            </div>
                          </>
                        ) : (
                          <img src={post.mediaUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        )}
                      </div>

                      {/* Post info */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {post.caption || "Untitled post"}
                        </div>
                        <div style={{ fontSize: 11, color: COLORS.textSecondary, marginTop: 2 }}>
                          <span style={{ color: COLORS.neonBlue }}>{post.businessName}</span>
                          {" \u2022 "}by {post.submitter.name}
                          {" \u2022 "}{new Date(post.createdAt).toLocaleDateString()}
                        </div>
                      </div>

                      {/* Status badge */}
                      <Badge status={post.status} />

                      {/* Comment count */}
                      <div style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 5,
                        padding: "5px 10px",
                        background: "rgba(0,212,255,0.12)",
                        border: "1px solid rgba(0,212,255,0.25)",
                        borderRadius: 20,
                        fontSize: 12,
                        fontWeight: 700,
                        color: COLORS.neonBlue,
                        flexShrink: 0,
                      }}>
                        💬 {post.commentCount}
                      </div>

                      {/* Expand arrow */}
                      <span style={{ fontSize: 12, color: COLORS.textSecondary, flexShrink: 0 }}>
                        {expandedPostId === post.id ? "\u25B2" : "\u25BC"}
                      </span>
                    </button>

                    {/* Expanded comments panel */}
                    {expandedPostId === post.id && (
                      <div style={{
                        background: "rgba(0,212,255,0.03)",
                        border: "1px solid rgba(0,212,255,0.25)",
                        borderTop: "none",
                        borderRadius: "0 0 10px 10px",
                        padding: "12px 14px",
                      }}>
                        {/* Search within this post */}
                        <div style={{ display: "flex", gap: 8, marginBottom: 10, alignItems: "center" }}>
                          <input
                            type="text"
                            placeholder="Search comments by text or username..."
                            value={perPostSearch}
                            onChange={(e) => handlePerPostSearchChange(e.target.value, post.id)}
                            style={{
                              flex: 1,
                              padding: "7px 12px",
                              borderRadius: 8,
                              border: "1px solid " + COLORS.cardBorder,
                              background: COLORS.darkBg,
                              color: COLORS.textPrimary,
                              fontSize: 12,
                              fontFamily: "inherit",
                            }}
                          />
                          {perPostSearch && (
                            <button
                              onClick={() => { setPerPostSearch(""); fetchPostComments(post.id, 1, ""); }}
                              style={actionBtn(COLORS.textSecondary)}
                            >
                              Clear
                            </button>
                          )}
                        </div>

                        {expandedCommentsLoading ? (
                          <div style={{ textAlign: "center", padding: 20, color: COLORS.textSecondary, fontSize: 13 }}>
                            {perPostSearch ? "Searching..." : "Loading comments..."}
                          </div>
                        ) : expandedComments.length === 0 ? (
                          <div style={{ textAlign: "center", padding: 20, color: COLORS.textSecondary, fontSize: 13 }}>
                            {perPostSearch ? `No comments matching "${perPostSearch}"` : "No comments"}
                          </div>
                        ) : (
                          <>
                            {/* Result info */}
                            <div style={{ fontSize: 11, color: COLORS.textSecondary, marginBottom: 8 }}>
                              {perPostSearch
                                ? `${expandedTotalRows} result${expandedTotalRows !== 1 ? "s" : ""}`
                                : expandedTotalRows > 20
                                  ? `Showing ${(expandedPage - 1) * 20 + 1}\u2013${Math.min(expandedPage * 20, expandedTotalRows)} of ${expandedTotalRows}`
                                  : `${expandedTotalRows} comment${expandedTotalRows !== 1 ? "s" : ""}`}
                            </div>

                            {/* Comments list */}
                            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                              {expandedComments.map((c) => (
                                <div
                                  key={c.id}
                                  style={{
                                    display: "flex",
                                    alignItems: "flex-start",
                                    gap: 10,
                                    padding: "10px 12px",
                                    background: COLORS.darkBg,
                                    border: "1px solid " + COLORS.cardBorder,
                                    borderRadius: 8,
                                  }}
                                >
                                  {/* Avatar */}
                                  <div style={{
                                    width: 32,
                                    height: 32,
                                    borderRadius: "50%",
                                    background: COLORS.gradient3,
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    fontSize: 12,
                                    fontWeight: 700,
                                    flexShrink: 0,
                                  }}>
                                    {c.user.name.charAt(0).toUpperCase()}
                                  </div>

                                  {/* Body */}
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ display: "flex", alignItems: "baseline", gap: 6, flexWrap: "wrap", marginBottom: 3 }}>
                                      <span style={{ fontWeight: 600, fontSize: 12 }}>{c.user.name}</span>
                                      {c.user.username && (
                                        <span style={{ fontSize: 11, color: COLORS.neonBlue }}>@{c.user.username}</span>
                                      )}
                                      <span style={{ fontSize: 10, color: COLORS.textSecondary }}>
                                        {formatDateTime(c.createdAt)}
                                      </span>
                                    </div>
                                    <div style={{ fontSize: 12, color: COLORS.textPrimary, lineHeight: 1.45, wordBreak: "break-word" }}>
                                      {c.body}
                                    </div>
                                    {c.likeCount > 0 && (
                                      <div style={{ fontSize: 10, color: COLORS.textSecondary, marginTop: 3 }}>
                                        {c.likeCount} {c.likeCount === 1 ? "like" : "likes"}
                                      </div>
                                    )}
                                  </div>

                                  {/* Delete */}
                                  <button
                                    onClick={() => handleDeleteComment(c.id, post.id)}
                                    disabled={commentActionLoading === c.id}
                                    style={{
                                      ...actionBtn(COLORS.neonRed),
                                      flexShrink: 0,
                                      alignSelf: "center",
                                      fontSize: 10,
                                    }}
                                  >
                                    {commentActionLoading === c.id ? "..." : "Delete"}
                                  </button>
                                </div>
                              ))}
                            </div>

                            {/* Pagination */}
                            {expandedTotalPages > 1 && (
                              <div style={{
                                display: "flex",
                                justifyContent: "center",
                                alignItems: "center",
                                gap: 10,
                                marginTop: 12,
                                paddingTop: 10,
                                borderTop: "1px solid " + COLORS.cardBorder,
                              }}>
                                <button
                                  onClick={() => fetchPostComments(post.id, expandedPage - 1, perPostSearch.trim())}
                                  disabled={expandedPage <= 1 || expandedCommentsLoading}
                                  style={{
                                    ...btnStyle(false),
                                    fontSize: 11,
                                    padding: "5px 12px",
                                    opacity: expandedPage <= 1 ? 0.4 : 1,
                                    cursor: expandedPage <= 1 ? "not-allowed" : "pointer",
                                  }}
                                >
                                  Prev
                                </button>
                                <span style={{ fontSize: 12, color: COLORS.textSecondary }}>
                                  {expandedPage} / {expandedTotalPages}
                                </span>
                                <button
                                  onClick={() => fetchPostComments(post.id, expandedPage + 1, perPostSearch.trim())}
                                  disabled={expandedPage >= expandedTotalPages || expandedCommentsLoading}
                                  style={{
                                    ...btnStyle(false),
                                    fontSize: 11,
                                    padding: "5px 12px",
                                    opacity: expandedPage >= expandedTotalPages ? 0.4 : 1,
                                    cursor: expandedPage >= expandedTotalPages ? "not-allowed" : "pointer",
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
          </Card>
        </>
      )}

      {/* Media Preview Modal */}
      {previewUrl && (
        <div
          onClick={() => setPreviewUrl(null)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.85)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            cursor: "pointer",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: "90vw", maxHeight: "90vh", position: "relative" }}
          >
            {previewType === "video" ? (
              <video
                src={previewUrl}
                controls
                autoPlay
                style={{ maxWidth: "90vw", maxHeight: "85vh", borderRadius: 12 }}
              />
            ) : (
              <img
                src={previewUrl}
                alt="Preview"
                style={{ maxWidth: "90vw", maxHeight: "85vh", borderRadius: 12, objectFit: "contain" }}
              />
            )}
            <button
              onClick={() => setPreviewUrl(null)}
              style={{
                position: "absolute",
                top: -12,
                right: -12,
                width: 32,
                height: 32,
                borderRadius: "50%",
                background: COLORS.neonRed,
                border: "none",
                color: "#fff",
                fontSize: 16,
                fontWeight: 700,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              ×
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
