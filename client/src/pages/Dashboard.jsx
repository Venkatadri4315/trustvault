import { useEffect, useMemo, useState } from "react";
import {
  ShieldCheck,
  UserPlus,
  LayoutDashboard,
  Files,
  Share2,
  Clock3,
  Settings,
  Search,
  Bell,
  Plus,
  Download,
  Eye,
  Pencil,
  MoreHorizontal,
  FileText,
  FileImage,
  FileSpreadsheet,
  FileArchive,
  ChevronDown,
  LockKeyhole,
  Menu,
  X,
  ArrowUpRight,
  HardDrive,
  Activity,
  CheckCircle2,
  SlidersHorizontal,
  ArrowRight,
  LoaderCircle,
  AlertCircle,
  RefreshCw,
  LogOut,
} from "lucide-react";
import { apiRequest } from "../services/api.js";
import { useAuth } from "../context/AuthContext";
import "../App.css";
const navItems = [
  { label: "Overview", icon: LayoutDashboard },
  { label: "All documents", icon: Files },
  { label: "Shared with me", icon: Share2 },
  { label: "Activity log", icon: Clock3 },
];
function formatSize(bytes = 0) {
  const size = Number(bytes) || 0;
  if (size >= 1024 * 1024) {
    return `${(size / (1024 * 1024)).toFixed(2)} MB`;
  }
  if (size >= 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }
  return `${size} B`;
}
function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
function getFileType(document) {
  const mime = (document.mime_type || "").toLowerCase();
  const filename = (
    document.original_filename ||
    document.title ||
    ""
  ).toLowerCase();
  if (mime.includes("image")) return "image";
  if (
    mime.includes("spreadsheet") ||
    /\.(xlsx|xls|csv)$/.test(filename)
  ) {
    return "sheet";
  }
  if (/\.(zip|rar|7z)$/.test(filename)) {
    return "archive";
  }
  return "pdf";
}
function DocumentIcon({ type }) {
  const Icon =
    type === "image"
      ? FileImage
      : type === "sheet"
        ? FileSpreadsheet
        : type === "archive"
          ? FileArchive
          : FileText;
  return (
    <span className={`document-icon ${type}`}>
      <Icon size={20} strokeWidth={1.8} />
    </span>
  );
}
function StatCard({ label, value, detail, icon: Icon, accent }) {
  return (
    <article className={`stat-card ${accent}`}>
      <div className="stat-card-top">
        <span className="stat-label">{label}</span>
        <span className="stat-icon">
          <Icon size={19} strokeWidth={1.8} />
        </span>
      </div>
      <div className="stat-value">{value}</div>
      <div className="stat-card-bottom">
        <span>{detail}</span>
      </div>
    </article>
  );
}
export default function Dashboard() {
  const { token, user, logout } = useAuth();
  const [activePage, setActivePage] = useState("Overview");
  const [search, setSearch] = useState("");
  const [documents, setDocuments] = useState([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [previewDocument, setPreviewDocument] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [previewText, setPreviewText] = useState("");
  const [previewLoading, setPreviewLoading] = useState(false);
  const [editingDocument, setEditingDocument] = useState(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [sharingDocument, setSharingDocument] = useState(null);
  const [shareUserId, setShareUserId] = useState("");
  const [sharePermission, setSharePermission] = useState("read_only");
  const [sharing, setSharing] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [downloadingId, setDownloadingId] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  async function loadDocuments() {
    setLoading(true);
    setError("");
    try {
      const result = await apiRequest("/documents", { token });
      setDocuments(Array.isArray(result.documents) ? result.documents : []);
    } catch (err) {
      setError(err.message || "Could not load your documents.");
      if (err.status === 401) logout();
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    loadDocuments();
    // Load again if the authenticated session changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);
  const visibleDocuments = useMemo(() => {
    let result = documents.filter((document) => {
      const searchable = [
        document.title,
        document.original_filename,
        document.category,
        document.description,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return searchable.includes(search.trim().toLowerCase());
    });
    if (activePage === "Shared with me") {
      result = result.filter(
        (document) => document.access_level !== "owner"
      );
    }
    if (activePage === "Overview") return result.slice(0, 5);
    return result;
  }, [documents, search, activePage]);
  const sharedCount = documents.filter(
    (document) => document.access_level !== "owner"
  ).length;
  const storageBytes = documents.reduce(
    (total, document) => total + (Number(document.size_bytes) || 0),
    0
  );
  const pageTitle =
    activePage === "Overview" ? "Your workspace" : activePage;
  function openEdit(document) {
    setEditingDocument(document);
    setEditTitle(document.title || "");
    setEditDescription(document.description || "");
    setEditCategory(document.category || "");
    setError("");
    setNotice("");
    setShowEdit(true);
  }

  function closeEdit() {
    if (savingEdit) return;
    setShowEdit(false);
    setEditingDocument(null);
  }

  async function handleEdit(event) {
    event.preventDefault();
    if (!editingDocument || !editTitle.trim()) {
      setError("Document title is required.");
      return;
    }
    setSavingEdit(true);
    setError("");
    setNotice("");
    try {
      await apiRequest(`/documents/${encodeURIComponent(editingDocument.id)}`, {
        method: "PATCH",
        token,
        body: {
          title: editTitle.trim(),
          description: editDescription.trim(),
          category: editCategory.trim(),
        },
      });
      setShowEdit(false);
      setEditingDocument(null);
      setNotice("Document updated successfully.");
      await loadDocuments();
    } catch (err) {
      setError(err.message || "Could not update the document.");
      if (err.status === 401) logout();
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleUpload(event) {
    event.preventDefault();
    if (!selectedFile) {
      setError("Choose a file to upload.");
      return;
    }
    if (selectedFile.size > 5 * 1024 * 1024) {
      setError("File size must not exceed 5 MB.");
      return;
    }
    const allowedTypes = [
      "application/pdf",
      "image/png",
      "image/jpeg",
      "text/plain",
    ];
    if (!allowedTypes.includes(selectedFile.type)) {
      setError("Supported files: PDF, PNG, JPEG, and plain text.");
      return;
    }
    if (!title.trim()) {
      setError("Enter a document title.");
      return;
    }
    const formData = new FormData();
    formData.append("file", selectedFile);
    formData.append("title", title.trim());
    if (description.trim()) {
      formData.append("description", description.trim());
    }
    if (category.trim()) {
      formData.append("category", category.trim());
    }
    setUploading(true);
    setError("");
    setNotice("");
    try {
      await apiRequest("/documents", {
        method: "POST",
        token,
        body: formData,
      });
      setShowUpload(false);
      setSelectedFile(null);
      setTitle("");
      setDescription("");
      setCategory("");
      setNotice("Document uploaded successfully.");
      await loadDocuments();
    } catch (err) {
      setError(err.message || "Document upload failed.");
      if (err.status === 401) logout();
    } finally {
      setUploading(false);
    }
  }
  async function handlePreview(document) {
    setPreviewLoading(true);
    setError("");
    setPreviewText("");
    setPreviewDocument(document);
    setPreviewUrl("");
    try {
      const response = await apiRequest(
        `/documents/${encodeURIComponent(document.id)}/preview`,
        { token }
      );
      const blob = await response.blob();
      const mime = (blob.type || document.mime_type || "").toLowerCase();
      if (mime.startsWith("text/") || /\.txt$/i.test(document.original_filename || document.title || "")) {
        setPreviewText(await blob.text());
      } else {
        setPreviewUrl(URL.createObjectURL(blob));
      }
    } catch (err) {
      setError(err.message || "Could not preview this document.");
      setPreviewDocument(null);
      if (err.status === 401) logout();
    } finally {
      setPreviewLoading(false);
    }
  }

  function closePreview() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl("");
    setPreviewText("");
    setPreviewDocument(null);
  }

  async function handleDownload(document) {
    setDownloadingId(document.id);
    setError("");
    setNotice("");
    try {
      const response = await apiRequest(
        `/documents/${encodeURIComponent(document.id)}/download`,
        { token }
      );
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = window.document.createElement("a");
      anchor.href = url;
      anchor.download =
        document.original_filename || document.title || "document";
      window.document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      setNotice("Download started.");
    } catch (err) {
      setError(err.message || "Could not download the document.");
      if (err.status === 401) logout();
    } finally {
      setDownloadingId(null);
    }
  }
  function openShare(document) {
    setSharingDocument(document);
    setShareUserId("");
    setSharePermission("read_only");
    setError("");
    setNotice("");
    setShowShare(true);
  }
  function closeShare() {
    if (sharing) return;
    setShowShare(false);
    setSharingDocument(null);
    setShareUserId("");
    setSharePermission("read_only");
  }
  async function handleShare(event) {
    event.preventDefault();
    const targetEmail = shareUserId.trim().toLowerCase();
    if (!sharingDocument) {
      setError("Choose a document to share.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(targetEmail)) {
      setError("Enter a valid recipient email address.");
      return;
    }
    if (user?.email && targetEmail === user.email.trim().toLowerCase()) {
      setError("You cannot share a document with yourself.");
      return;
    }
    const validPermissions = [
      "read_only",
      "read_download",
      "edit_only",
      "edit_download",
    ];
    if (!validPermissions.includes(sharePermission)) {
      setError("Select a valid permission.");
      return;
    }
    setSharing(true);
    setError("");
    setNotice("");
    try {
      await apiRequest(
        `/documents/${encodeURIComponent(sharingDocument.id)}/share`,
        {
          method: "POST",
          token,
          body: {
            email: targetEmail,
            permission: sharePermission,
          },
        }
      );
      setShowShare(false);
      setSharingDocument(null);
      setShareUserId("");
      setSharePermission("read_only");
      setNotice(`Document access granted to ${targetEmail}.`);
      await loadDocuments();
    } catch (err) {
      setError(err.message || "Could not share this document.");
      if (err.status === 401) logout();
    } finally {
      setSharing(false);
    }
  }
  async function handleDelete(document) {
   const confirmed = window.confirm(
  `Move "${document.title}" to the deleted state?`
);
    if (!confirmed) return;
    setError("");
    setNotice("");
    try {
      await apiRequest(`/documents/${encodeURIComponent(document.id)}`, {
        method: "DELETE",
        token,
      });
      setNotice("Document deleted.");
      await loadDocuments();
    } catch (err) {
      setError(err.message || "Could not delete this document.");
      if (err.status === 401) logout();
    }
  }
  function changePage(label) {
    setActivePage(label);
    setMenuOpen(false);
    setError("");
    setNotice("");
  }
  function closeUpload() {
    if (uploading) return;
    setShowUpload(false);
    setSelectedFile(null);
    setTitle("");
    setDescription("");
    setCategory("");
  }
  return (
    <div className="app-shell">
      {menuOpen && (
        <button
          className="mobile-backdrop"
          aria-label="Close navigation"
          onClick={() => setMenuOpen(false)}
        />
      )}
      <aside className={`sidebar ${menuOpen ? "sidebar-open" : ""}`}>
        <a className="brand" href="#workspace">
          <span className="brand-mark">
            <ShieldCheck size={25} strokeWidth={2} />
          </span>
          <span className="brand-name">
            Trust<span>Vault</span>
          </span>
        </a>
        <div className="workspace-switcher">
          <div className="workspace-avatar">
            {(user?.email || "U").charAt(0).toUpperCase()}
          </div>
          <div className="workspace-copy">
            <span>WORKSPACE</span>
            <strong>Personal space</strong>
          </div>
          <ChevronDown size={16} />
        </div>
        <div className="sidebar-section-label">WORKSPACE</div>
        <nav className="main-nav" aria-label="Main navigation">
          {navItems.map(({ label, icon: Icon }) => (
            <button
              key={label}
              className={`nav-item ${activePage === label ? "active" : ""}`}
              onClick={() => changePage(label)}
            >
              <Icon size={19} strokeWidth={1.8} />
              <span>{label}</span>
              {label === "All documents" && (
                <span className="nav-count">{documents.length}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="security-card">
            <span className="security-card-icon">
              <LockKeyhole size={18} />
            </span>
            <span className="security-card-label">YOUR SPACE, YOUR RULES</span>
            <strong>Privacy comes first.</strong>
            <p>
              Keep your documents organized and control who can access them.
            </p>
            <div className="security-card-foot">
              <span className="security-status-dot" />
              Access controls available
            </div>
          </div>
          <button
            className={`nav-item settings-link ${
              activePage === "Settings" ? "active" : ""
            }`}
            onClick={() => changePage("Settings")}
          >
            <Settings size={19} strokeWidth={1.8} />
            <span>Settings</span>
          </button>
          <div className="profile">
            <div className="avatar">
              {(user?.email || "U").charAt(0).toUpperCase()}
            </div>
            <div className="profile-copy">
              <strong>{user?.email || "Signed-in user"}</strong>
              <span>{user?.role || "TrustVault user"}</span>
            </div>
            <button
              className="icon-button"
              onClick={logout}
              aria-label="Sign out"
              title="Sign out"
            >
              <LogOut size={17} />
            </button>
          </div>
        </div>
      </aside>
      <main className="main-area">
        <header className="topbar">
          <div className="topbar-left">
            <button
              className="icon-button mobile-menu"
              aria-label="Open navigation"
              onClick={() => setMenuOpen(true)}
            >
              <Menu size={21} />
            </button>
            <div className="breadcrumb">
              <span>Workspace</span>
              <span className="breadcrumb-separator">/</span>
              <strong>{activePage}</strong>
            </div>
          </div>
          <div className="topbar-actions">
            <label className="search-box">
              <Search size={18} />
              <input
                aria-label="Search documents"
                placeholder="Search your files..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
              {search && (
                <button
                  type="button"
                  className="search-clear"
                  aria-label="Clear search"
                  onClick={() => setSearch("")}
                >
                  <X size={15} />
                </button>
              )}
            </label>
            <button
              className="icon-button notification-button"
              aria-label="Notifications"
              title="Notifications are not connected yet"
            >
              <Bell size={19} strokeWidth={1.8} />
            </button>
            <div className="top-avatar" title={user?.email || "Signed-in user"}>
              {(user?.email || "U").charAt(0).toUpperCase()}
            </div>
          </div>
        </header>
        <div className="page-content">
          <div className="demo-banner">
            <span className="demo-banner-dot" />
            <span>
              Live API <span className="demo-banner-divider">·</span>{" "}
              Documents loaded from TrustVault
            </span>
          </div>
          {error && (
            <div className="dashboard-message error-message" role="alert">
              <AlertCircle size={18} />
              <span>{error}</span>
              <button
                className="icon-button"
                onClick={loadDocuments}
                aria-label="Retry loading documents"
              >
                <RefreshCw size={16} />
              </button>
            </div>
          )}
          {notice && (
            <div className="dashboard-message success-message" role="status">
              <CheckCircle2 size={18} />
              <span>{notice}</span>
              <button
                className="icon-button"
                onClick={() => setNotice("")}
                aria-label="Dismiss notification"
              >
                <X size={16} />
              </button>
            </div>
          )}
          <section className="welcome-row">
            <div className="welcome-copy">
              <div className="eyebrow">
                <span className="eyebrow-line" />
                YOUR SECURE WORKSPACE
              </div>
              <h1>
                {activePage === "Overview" ? (
                  <>
                    Everything in <span>its place.</span>
                  </>
                ) : (
                  pageTitle
                )}
              </h1>
              <p className="page-subtitle">
                One calm, secure place for all the documents that matter.
              </p>
            </div>
            <button
              className="primary-button"
              onClick={() => {
                setError("");
                setShowUpload(true);
              }}
            >
              <Plus size={19} />
              <span>Upload document</span>
            </button>
          </section>
          {activePage === "Settings" ? (
            <section className="settings-placeholder">
              <span className="settings-placeholder-icon">
                <Settings size={26} />
              </span>
              <h2>My Account</h2>
              <p>View your TrustVault account details below.</p>
              <div className="account-details">
                <p><strong>User ID:</strong> {user?.id ?? "Unavailable"}</p>
                <p><strong>Email:</strong> {user?.email ?? "Unavailable"}</p>
                <p><strong>Role:</strong> {user?.role ?? "TrustVault user"}</p>
                <button
                  type="button"
                  className="secondary-button"
                  disabled={user?.id == null}
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(String(user.id));
                      setNotice("User ID copied to clipboard.");
                    } catch {
                      setError("Could not copy the User ID. Please copy it manually.");
                    }
                  }}
                >
                  Copy User ID
                </button>
              </div>
              <button
                className="secondary-button"
                onClick={() => changePage("Overview")}
              >
                Return to overview <ArrowRight size={16} />
              </button>
            </section>
          ) : activePage === "Activity log" ? (
            <section className="activity-placeholder">
              <span className="settings-placeholder-icon">
                <Activity size={26} />
              </span>
              <h2>Activity log</h2>
              <p>
                The backend writes audit logs, but it does not currently expose
                an audit-log listing endpoint.
              </p>
              <button
                className="secondary-button"
                onClick={() => changePage("Overview")}
              >
                Return to overview <ArrowRight size={16} />
              </button>
            </section>
          ) : (
            <>
              <section className="stats-grid" aria-label="Workspace summary">
                <StatCard
                  label="Accessible documents"
                  value={loading ? "—" : documents.length}
                  detail="Available to your account"
                  icon={Files}
                  accent="stat-green"
                />
                <StatCard
                  label="Shared with me"
                  value={loading ? "—" : sharedCount}
                  detail="Documents not owned by you"
                  icon={Share2}
                  accent="stat-sand"
                />
                <StatCard
                  label="Storage used"
                  value={loading ? "—" : formatSize(storageBytes)}
                  detail="Based on accessible files"
                  icon={HardDrive}
                  accent="stat-blue"
                />
              </section>
              <section className="documents-section">
                <div className="section-heading">
                  <div>
                    <div className="section-kicker">YOUR LIBRARY</div>
                    <h2>
                      {activePage === "Shared with me"
                        ? "Shared documents"
                        : activePage === "All documents"
                          ? "All documents"
                          : "Recent documents"}
                    </h2>
                    <p>
                      Your files at a glance, with access details close at hand.
                    </p>
                  </div>
                  <button
                    className="text-button"
                    onClick={() => changePage("All documents")}
                  >
                    View all documents <ArrowUpRight size={16} />
                  </button>
                </div>
                <div className="table-card">
                  <div className="table-toolbar">
                    <div className="table-title-group">
                      <h3>Documents</h3>
                      <span className="table-count">
                        {loading ? "…" : visibleDocuments.length}
                      </span>
                    </div>
                    <div className="table-tools">
                      <span className="preview-label">
                        <SlidersHorizontal size={15} />
                        File library
                      </span>
                      {search && (
                        <button
                          className="filter-button"
                          onClick={() => setSearch("")}
                        >
                          Clear search <X size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="table-scroll">
                    <table>
                      <thead>
                        <tr>
                          <th>DOCUMENT NAME</th>
                          <th>FILE SIZE</th>
                          <th>LAST MODIFIED</th>
                          <th>ACCESS</th>
                          <th aria-label="Actions" />
                        </tr>
                      </thead>
                      <tbody>
                        {loading ? (
                          <tr>
                            <td colSpan="5" className="empty-state">
                              <LoaderCircle size={22} />
                              <strong>Loading documents…</strong>
                              <span>Connecting to your secure library.</span>
                            </td>
                          </tr>
                        ) : visibleDocuments.length === 0 ? (
                          <tr>
                            <td colSpan="5" className="empty-state">
                              <Files size={22} />
                              <strong>No documents found</strong>
                              <span>
                                Upload a document or try a different search.
                              </span>
                              {search && (
                                <button
                                  className="text-button"
                                  onClick={() => setSearch("")}
                                >
                                  Clear search
                                </button>
                              )}
                            </td>
                          </tr>
                        ) : (
                          visibleDocuments.map((document) => {
                            const isOwner =
                              document.access_level === "owner";
                            return (
                              <tr key={document.id}>
                                <td>
                                  <div className="file-cell">
                                    <DocumentIcon
                                      type={getFileType(document)}
                                    />
                                    <div className="file-copy">
                                      <strong>{document.title}</strong>
                                      <span>
                                        {document.original_filename ||
                                          document.category ||
                                          "Document"}
                                      </span>
                                    </div>
                                  </div>
                                </td>
                                <td className="file-size">
                                  {formatSize(document.size_bytes)}
                                </td>
                                <td className="file-date">
                                  {formatDate(
                                    document.updated_at ||
                                      document.created_at
                                  )}
                                </td>
                                <td>
                                  <span
                                    className={`access-badge ${
                                      isOwner ? "private" : "shared"
                                    }`}
                                  >
                                    <span className="access-dot" />
                                    {isOwner
                                      ? "Owned by you"
                                      : document.access_level || "Shared"}
                                  </span>
                                </td>
                                <td>
                                  <div className="document-actions">
                                    <button
                                      type="button"
                                      className="icon-button row-menu"
                                      aria-label={`View ${document.title}`}
                                      title="View document"
                                      onClick={() => handlePreview(document)}
                                    >
                                      <Eye size={18} />
                                    </button>
                                    <button
                                      className="icon-button row-menu"
                                      aria-label={`Download ${document.title}`}
                                      title="Download document"
                                      disabled={
                                        downloadingId === document.id
                                      }
                                      onClick={() =>
                                        handleDownload(document)
                                      }
                                    >
                                      {downloadingId === document.id ? (
                                        <LoaderCircle size={18} />
                                      ) : (
                                        <Download size={18} />
                                      )}
                                    </button>
                                    {isOwner && (
                                      <button
                                        type="button"
                                        className="icon-button row-menu"
                                        aria-label={`Edit ${document.title}`}
                                        title="Edit document details"
                                        onClick={() => openEdit(document)}
                                      >
                                        <Pencil size={18} />
                                      </button>
                                    )}
                                    {isOwner && (
                                      <button
                                        className="icon-button row-menu"
                                        aria-label={`Share ${document.title}`}
                                        title="Share document"
                                        onClick={() => openShare(document)}
                                      >
                                        <UserPlus size={18} />
                                      </button>
                                    )}
                                    {isOwner && (
                                      <button
                                        className="icon-button row-menu"
                                        aria-label={`Delete ${document.title}`}
                                        title="Delete document"
                                        onClick={() =>
                                          handleDelete(document)
                                        }
                                      >
                                        <MoreHorizontal size={19} />
                                      </button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                  <div className="table-footer">
                    <span>
                      {loading
                        ? "Loading your library"
                        : `Showing ${visibleDocuments.length} of ${documents.length} documents`}
                    </span>
                    <span className="table-protected">
                      <ShieldCheck size={15} />
                      Protected by TrustVault
                    </span>
                  </div>
                </div>
              </section>
              <section className="bottom-insight">
                <div className="insight-icon">
                  <CheckCircle2 size={21} />
                </div>
                <div className="insight-copy">
                  <strong>Keep your digital workspace organized</strong>
                  <span>
                    Review access and keep important files in one place.
                  </span>
                </div>
                <button
                  className="insight-action"
                  onClick={() => changePage("Shared with me")}
                >
                  Review shared files <ArrowRight size={16} />
                </button>
              </section>
            </>
          )}
          <footer className="app-footer">
            <span>© {new Date().getFullYear()} TrustVault</span>
            <span>
              <ShieldCheck size={15} />
              Thoughtfully designed for document security
            </span>
          </footer>
        </div>
      </main>
      {showEdit && editingDocument && (
        <div className="modal-backdrop" onClick={closeEdit}>
          <section
            className="upload-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-heading">
              <div>
                <div className="section-kicker">DOCUMENT LIBRARY</div>
                <h2 id="edit-title">Edit document</h2>
                <p>Update your document details.</p>
              </div>
              <button
                type="button"
                className="icon-button"
                aria-label="Close edit dialog"
                disabled={savingEdit}
                onClick={closeEdit}
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleEdit}>
              <label className="form-field">
                <span>Document title *</span>
                <input
                  value={editTitle}
                  onChange={(event) => setEditTitle(event.target.value)}
                  maxLength={255}
                  required
                />
              </label>
              <label className="form-field">
                <span>Description</span>
                <textarea
                  value={editDescription}
                  onChange={(event) => setEditDescription(event.target.value)}
                  maxLength={2000}
                  rows={3}
                />
              </label>
              <label className="form-field">
                <span>Category</span>
                <input
                  value={editCategory}
                  onChange={(event) => setEditCategory(event.target.value)}
                  maxLength={100}
                />
              </label>
              <div className="modal-actions">
                <button
                  type="button"
                  className="secondary-button"
                  disabled={savingEdit}
                  onClick={closeEdit}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="primary-button"
                  disabled={savingEdit || !editTitle.trim()}
                >
                  {savingEdit ? (
                    <>
                      <LoaderCircle size={17} />
                      Saving…
                    </>
                  ) : (
                    <>
                      <Pencil size={17} />
                      Save changes
                    </>
                  )}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {previewDocument && (
        <div className="modal-backdrop" onClick={closePreview}>
          <section className="upload-modal" role="dialog" aria-modal="true" aria-labelledby="preview-title" onClick={(event) => event.stopPropagation()} style={{ width: "min(900px, 94vw)", maxWidth: "900px" }}>
            <div className="modal-heading">
              <div>
                <div className="section-kicker">DOCUMENT PREVIEW</div>
                <h2 id="preview-title">{previewDocument.title}</h2>
                <p>Viewing document securely in TrustVault.</p>
              </div>
              <button type="button" className="icon-button" aria-label="Close preview" onClick={closePreview}><X size={20} /></button>
            </div>
            <div style={{ minHeight: "55vh", maxHeight: "70vh", overflow: "auto", background: "#f7f8f6", borderRadius: "12px", padding: "12px" }}>
              {previewLoading ? (
                <div className="empty-state"><LoaderCircle size={22} /><strong>Loading preview…</strong></div>
              ) : previewText ? (
                <pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere", margin: 0, fontFamily: "inherit" }}>{previewText}</pre>
              ) : previewUrl && (previewDocument.mime_type || "").toLowerCase().startsWith("image/") ? (
                <img src={previewUrl} alt={previewDocument.title} style={{ display: "block", maxWidth: "100%", maxHeight: "65vh", margin: "0 auto", objectFit: "contain" }} />
              ) : previewUrl && ((previewDocument.mime_type || "").toLowerCase().includes("pdf") || /\.pdf$/i.test(previewDocument.original_filename || previewDocument.title || "")) ? (
                <iframe title={`Preview ${previewDocument.title}`} src={previewUrl} style={{ width: "100%", height: "65vh", border: 0, background: "white" }} />
              ) : (
                <div className="empty-state"><FileText size={24} /><strong>Preview not supported for this file type.</strong><span>Download the file to open it in a compatible application.</span></div>
              )}
            </div>
          </section>
        </div>
      )}

      {showShare && sharingDocument && (
        <div className="modal-backdrop" onClick={closeShare}>
          <section
            className="upload-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="share-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-heading">
              <div>
                <div className="section-kicker">DOCUMENT ACCESS</div>
                <h2 id="share-title">Share document</h2>
                <p>Grant a registered TrustVault user access to “{sharingDocument.title}”.</p>
              </div>
              <button
                type="button"
                className="icon-button"
                aria-label="Close share dialog"
                disabled={sharing}
                onClick={closeShare}
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleShare}>
              <label className="form-field">
                <span>Recipient email *</span>
                <input
                  type="email"
                  autoComplete="email"
                  value={shareUserId}
                  required
                  onChange={(event) => setShareUserId(event.target.value)}
                  placeholder="user@example.com"
                />
                <small>
                  Enter the email address of an existing, active TrustVault account.
                </small>
              </label>
              <label className="form-field">
                <span>Permission *</span>
                <select
                  value={sharePermission}
                  onChange={(event) => setSharePermission(event.target.value)}
                >
                  <option value="read_only">View only — no download</option>
                  <option value="read_download">View and download</option>
                  <option value="edit_only">View and edit — no download</option>
                  <option value="edit_download">View, edit and download</option>
                </select>
              </label>
              <div className="demo-note">
                <LockKeyhole size={17} />
                <p><strong>Owner control.</strong> Only the document owner can grant access. You can revoke access separately.</p>
              </div>
              <div className="modal-actions">
                <button type="button" className="secondary-button" disabled={sharing} onClick={closeShare}>
                  Cancel
                </button>
                <button type="submit" className="primary-button" disabled={sharing || !shareUserId.trim()}>
                  {sharing ? (
                    <>
                      <LoaderCircle size={17} />
                      Sharing…
                    </>
                  ) : (
                    <>
                      <UserPlus size={17} />
                      Share document
                    </>
                  )}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
      {showUpload && (
        <div className="modal-backdrop" onClick={closeUpload}>
          <section
            className="upload-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="upload-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-heading">
              <div>
                <div className="section-kicker">DOCUMENT LIBRARY</div>
                <h2 id="upload-title">Add a document</h2>
                <p>Upload a supported file to your secure workspace.</p>
              </div>
              <button
                className="icon-button"
                aria-label="Close upload dialog"
                disabled={uploading}
                onClick={closeUpload}
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleUpload}>
              <label className="form-field">
                <span>Document title *</span>
                <input
                  value={title}
                  maxLength={255}
                  required
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="e.g. Project Proposal"
                />
              </label>
              <label className="form-field">
                <span>Description</span>
                <textarea
                  value={description}
                  maxLength={2000}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="Optional description"
                  rows={3}
                />
              </label>
              <label className="form-field">
                <span>Category</span>
                <input
                  value={category}
                  maxLength={100}
                  onChange={(event) => setCategory(event.target.value)}
                  placeholder="e.g. Work, Personal, Finance"
                />
              </label>
              <label className="dropzone">
                <span className="upload-icon">
                  <Plus size={25} />
                </span>
                <strong>
                  {selectedFile ? selectedFile.name : "Choose a document"}
                </strong>
                <span>
                  {selectedFile
                    ? `${formatSize(selectedFile.size)} · Ready to upload`
                    : "PDF, PNG, JPEG, or TXT · Maximum 5 MB"}
                </span>
                <span className="dropzone-browse">Browse files</span>
                <input
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg,.txt,application/pdf,image/png,image/jpeg,text/plain"
                  onChange={(event) =>
                    setSelectedFile(event.target.files?.[0] || null)
                  }
                />
              </label>
              <div className="demo-note">
                <LockKeyhole size={17} />
                <p>
                  <strong>Secure upload.</strong> Your file will be sent to the
                  TrustVault backend for validation and storage.
                </p>
              </div>
              <div className="modal-actions">
                <button
                  type="button"
                  className="secondary-button"
                  disabled={uploading}
                  onClick={closeUpload}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="primary-button"
                  disabled={uploading || !selectedFile || !title.trim()}
                >
                  {uploading ? (
                    <>
                      <LoaderCircle size={17} />
                      Uploading…
                    </>
                  ) : (
                    <>
                      <Plus size={17} />
                      Upload document
                    </>
                  )}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
