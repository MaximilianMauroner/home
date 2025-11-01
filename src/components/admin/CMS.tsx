import { useState, useEffect } from "react";
import type { ChangeEvent, FormEvent } from "react";
import ReactMarkdown from "react-markdown";

type ContentType = "blog" | "log" | "snack";

interface FormData {
  type: ContentType;
  title: string;
  description: string;
  tags: string;
  image: string;
  published: boolean;
  releaseDate: string;
  content: string;
  slug: string;
  year?: string;
  month?: string;
}

interface Post {
  id: string;
  title: string;
  published: boolean;
}

interface PostList {
  blogs?: Post[];
  logs?: Post[];
  snacks?: Post[];
}

export default function CMS() {
  // Helper function to get ISO week number
  const getWeekNumber = (date: Date): string => {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
      .toString()
      .padStart(2, "0");
  };

  const now = new Date();
  const [formData, setFormData] = useState<FormData>({
    type: "blog",
    title: "",
    description: "",
    tags: "",
    image: "",
    published: false,
    releaseDate: now.toISOString().split("T")[0],
    content: "",
    slug: "",
    year: now.getFullYear().toString(),
    month: getWeekNumber(now),
  });

  const [postList, setPostList] = useState<PostList>({});
  const [loading, setLoading] = useState(false);
  const [currentPostId, setCurrentPostId] = useState<string | null>(null);
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Load posts when component mounts or type changes
  useEffect(() => {
    loadPosts();
  }, [formData.type]);

  const loadPosts = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/list?type=${formData.type}`);
      if (!response.ok) throw new Error("Failed to load posts");
      const data = await response.json();
      setPostList(data);
    } catch (error) {
      setMessage({ type: "error", text: "Failed to load posts" });
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const loadPost = async (type: ContentType, id: string) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/get?type=${type}&id=${id}`);
      if (!response.ok) throw new Error("Failed to load post");
      const data = await response.json();

      // Extract slug from ID for blog/snack (strip number prefix)
      let slug = data.slug || "";
      if ((type === "blog" || type === "snack") && /^\d{3}-/.test(id)) {
        slug = id.replace(/^\d{3}-/, "");
      } else if (type === "blog" || type === "snack") {
        slug = id;
      }

      setFormData({
        type: data.type,
        title: data.frontmatter.title,
        description: data.frontmatter.description,
        tags: data.frontmatter.tags.join(", "),
        image: data.frontmatter.image || "",
        published: data.frontmatter.published,
        releaseDate: data.frontmatter.releaseDate,
        content: data.content,
        slug,
        year: data.year || new Date().getFullYear().toString(),
        month: data.month || getWeekNumber(new Date()),
      });

      setCurrentPostId(id);
      setUploadedImages([]);
      setMessage({ type: "success", text: "Post loaded successfully" });
    } catch (error) {
      setMessage({ type: "error", text: "Failed to load post" });
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
      const now = new Date();
      setFormData({
        type: formData.type,
        title: "",
        description: "",
        tags: "",
        image: "",
        published: false,
        releaseDate: now.toISOString().split("T")[0],
        content: "",
        slug: "",
        year: now.getFullYear().toString(),
        month: getWeekNumber(now),
      });
    setCurrentPostId(null);
    setUploadedImages([]);
  };

  const handleInputChange = (
    e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;

    if (name === "tags") {
      setFormData((prev) => ({ ...prev, tags: value }));
    } else if (name === "slug") {
      setFormData((prev) => ({ ...prev, slug: value }));
    } else if (name === "type") {
      const newType = value as ContentType;
      const now = new Date();
      setFormData({
        type: newType,
        title: "",
        description: "",
        tags: "",
        image: "",
        published: false,
        releaseDate: now.toISOString().split("T")[0],
        content: "",
        slug: "",
        year: now.getFullYear().toString(),
        month: newType === "log" ? getWeekNumber(now) : "",
      });
      setCurrentPostId(null);
      setUploadedImages([]);
    } else {
      setFormData((prev) => ({
        ...prev,
        [name]: type === "checkbox" ? checked : value,
      }));
    }
  };

  const handleTitleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const title = e.target.value;
    setFormData((prev) => ({
      ...prev,
      title,
      slug:
        prev.slug === "" ||
        prev.slug === prev.title.toLowerCase().replace(/\s+/g, "-")
          ? title
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, "-")
              .replace(/(^-|-$)/g, "")
          : prev.slug,
    }));
  };

  const handleFileUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    setMessage(null);

    try {
      const uploadFormData = new FormData();
      Array.from(files).forEach((file) => {
        uploadFormData.append("files", file);
      });
      uploadFormData.append("contentType", formData.type);

      const response = await fetch("/api/admin/upload", {
        method: "POST",
        body: uploadFormData,
      });

      if (!response.ok) {
        throw new Error("Upload failed");
      }

      const data = await response.json();
      setUploadedImages((prev) => [...prev, ...data.urls]);
      setMessage({
        type: "success",
        text: `Successfully uploaded ${data.urls.length} file(s)`,
      });
    } catch (error) {
      setMessage({ type: "error", text: "Failed to upload files" });
      console.error(error);
    } finally {
      setUploading(false);
    }
  };

  const insertImageIntoContent = (imagePath: string) => {
    const imageMarkdown = `\n![${formData.title}](${imagePath})\n`;
    setFormData((prev) => ({
      ...prev,
      content: prev.content + imageMarkdown,
    }));
  };

  const handleDelete = async () => {
    if (!currentPostId) return;

    if (!confirm(`Are you sure you want to delete "${formData.title}"?`)) {
      return;
    }

    setDeleting(true);
    setMessage(null);

    try {
      const response = await fetch("/api/admin/delete", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type: formData.type,
          id: currentPostId,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to delete");
      }

      setMessage({ type: "success", text: "Post deleted successfully!" });
      resetForm();
      loadPosts();
    } catch (error) {
      setMessage({ type: "error", text: "Failed to delete post" });
      console.error(error);
    } finally {
      setDeleting(false);
    }
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      // Provide defaults for missing required fields
      const title = formData.title.trim() || "Untitled Post";
      const description = formData.description.trim() || "";
      const releaseDate = formData.releaseDate || new Date().toISOString().split("T")[0];
      const content = formData.content.trim() || "";

      // Generate slug if empty (for blog and snack)
      let slug = formData.slug.trim();
      if (formData.type !== "log" && !slug) {
        slug = title
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/(^-|-$)/g, "") || "untitled-post";
      }

      // Provide defaults for log year/week
      let year = formData.year?.trim() || new Date().getFullYear().toString();
      let week = formData.month?.trim() || getWeekNumber(new Date());

      // Parse tags
      const tagsArray = formData.tags
        .split(",")
        .map((tag) => tag.trim())
        .filter((tag) => tag.length > 0);

      // Determine file path based on type
      let filePath = "";
      if (formData.type === "log") {
        filePath = `${year}/${week}.mdx`;
      } else if (formData.type === "blog") {
        // Strip existing prefix if present, then add new one if needed
        const cleanSlug = slug.replace(/^\d{3}-/, "");
        const prefix = cleanSlug.match(/^\d{3}-/) ? "" : "001-";
        filePath = `${prefix}${cleanSlug}.mdx`;
      } else {
        // For snacks, get the next number and add prefix
        const cleanSlug = slug.replace(/^\d{3}-/, "");
        let snackNumber = "001";
        if (!currentPostId) {
          // Calculate next snack number
          const snacksResponse = await fetch("/api/admin/list?type=snack");
          if (snacksResponse.ok) {
            const snacksData = await snacksResponse.json();
            const existingSnacks = snacksData.snacks || [];
            // Extract numbers from existing snack IDs
            const numbers = existingSnacks
              .map((s: { id: string }) => {
                const match = s.id.match(/^(\d{3})-/);
                return match ? parseInt(match[1]) : 0;
              })
              .filter((n: number) => n > 0);
            const nextNum = numbers.length > 0 ? Math.max(...numbers) + 1 : 1;
            snackNumber = nextNum.toString().padStart(3, "0");
          }
        } else {
          // When editing, extract number from current ID
          const match = currentPostId.match(/^(\d{3})-/);
          snackNumber = match ? match[1] : "001";
        }
        filePath = `${snackNumber}-${cleanSlug}.mdx`;
      }

      const response = await fetch("/api/admin/save", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type: formData.type,
          filePath,
          frontmatter: {
            layout: `@/layouts/${formData.type === "blog" ? "Blog" : formData.type === "log" ? "Log" : "Snack"}Layout.astro`,
            title,
            ...(description && { description }),
            ...(tagsArray.length > 0 && { tags: tagsArray }),
            ...(formData.image && { image: formData.image }),
            published: formData.published,
            releaseDate,
          },
          content,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to save");
      }

      setMessage({
        type: "success",
        text: currentPostId
          ? "Content updated successfully! Reloading..."
          : "Content saved successfully! Reloading...",
      });

      // Reload the page after a short delay to show the success message
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (error) {
      setMessage({ type: "error", text: "Failed to save content" });
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  const currentPosts =
    formData.type === "blog"
      ? postList.blogs || []
      : formData.type === "log"
        ? postList.logs || []
        : postList.snacks || [];

  return (
    <div className="mx-auto w-full max-w-[95vw] space-y-6 p-6">
      <h1 className="mb-6 text-3xl font-bold text-gray-900 dark:text-gray-100">
        Admin CMS
      </h1>

      {message && (
        <div
          className={`rounded-lg border p-4 ${
            message.type === "success"
              ? "border-green-300 bg-green-50 text-green-800 dark:border-green-700 dark:bg-green-900/30 dark:text-green-200"
              : "border-red-300 bg-red-50 text-red-800 dark:border-red-700 dark:bg-red-900/30 dark:text-red-200"
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
        {/* Post List Sidebar */}
        <div className="lg:col-span-1">
          <div className="sticky top-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                Existing Posts
              </h2>
              <button
                onClick={resetForm}
                className="rounded-lg bg-gray-200 px-3 py-1 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
              >
                New
              </button>
            </div>

            {/* Content Type Filter */}
            <select
              value={formData.type}
              onChange={handleInputChange}
              name="type"
              className="w-full rounded-lg border border-gray-300 bg-white p-2 text-sm text-gray-900 transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:focus:border-blue-400"
            >
              <option value="blog">Blog</option>
              <option value="log">Log</option>
              <option value="snack">Snack</option>
            </select>

            {/* Post List */}
            <div className="max-h-[600px] space-y-2 overflow-y-auto rounded-lg border border-gray-200 bg-white p-2 dark:border-gray-700 dark:bg-gray-800">
              {loading ? (
                <div className="py-4 text-center text-sm text-gray-500 dark:text-gray-400">
                  Loading...
                </div>
              ) : currentPosts.length === 0 ? (
                <div className="py-4 text-center text-sm text-gray-500 dark:text-gray-400">
                  No posts found
                </div>
              ) : (
                currentPosts.map((post) => (
                  <button
                    key={post.id}
                    onClick={() => loadPost(formData.type, post.id)}
                    className={`w-full rounded-lg border p-3 text-left text-sm transition-colors ${
                      currentPostId === post.id
                        ? "border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-900/20"
                        : "border-gray-200 bg-gray-50 hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-700/50 dark:hover:bg-gray-700"
                    }`}
                  >
                    <div className="font-medium text-gray-900 dark:text-gray-100">
                      {post.title}
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                      <span
                        className={`rounded px-2 py-0.5 ${
                          post.published
                            ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                            : "bg-gray-200 text-gray-600 dark:bg-gray-600 dark:text-gray-400"
                        }`}
                      >
                        {post.published ? "Published" : "Draft"}
                      </span>
                      <span className="truncate text-gray-400 dark:text-gray-500">
                        {post.id}
                      </span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Form */}
        <div className="lg:col-span-3">
          <form onSubmit={handleSubmit} className="space-y-6">
            {currentPostId && (
              <div className="flex items-center justify-between rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-800 dark:bg-blue-900/20">
                <span className="text-sm font-medium text-blue-800 dark:text-blue-200">
                  Editing: {formData.title}
                </span>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleting}
                  className="rounded-lg bg-red-500 px-3 py-1 text-sm text-white transition-colors hover:bg-red-600 disabled:opacity-50 dark:bg-red-600 dark:hover:bg-red-700"
                >
                  {deleting ? "Deleting..." : "Delete"}
                </button>
              </div>
            )}

            {/* Log-specific fields */}
            {formData.type === "log" && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="year"
                    className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300"
                  >
                    Year
                  </label>
                  <input
                    type="text"
                    id="year"
                    name="year"
                    value={formData.year}
                    onChange={handleInputChange}
                    placeholder="2025"
                    className="w-full rounded-lg border border-gray-300 bg-white p-2 text-gray-900 transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:focus:border-blue-400"
                  />
                </div>
                <div>
                  <label
                    htmlFor="month"
                    className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300"
                  >
                    Week (01-53)
                  </label>
                  <input
                    type="text"
                    id="month"
                    name="month"
                    value={formData.month}
                    onChange={handleInputChange}
                    placeholder="17"
                    className="w-full rounded-lg border border-gray-300 bg-white p-2 text-gray-900 transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:focus:border-blue-400"
                  />
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    ISO week number (calendar week)
                  </p>
                </div>
              </div>
            )}

            {/* Slug (for blog and snack) */}
            {formData.type !== "log" && (
              <div>
                <label
                  htmlFor="slug"
                  className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  Slug (filename)
                </label>
                <input
                  type="text"
                  id="slug"
                  name="slug"
                  value={formData.slug}
                  onChange={handleInputChange}
                  placeholder="my-awesome-post"
                  disabled={!!currentPostId}
                  className="w-full rounded-lg border border-gray-300 bg-white p-2 text-gray-900 transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:bg-gray-100 disabled:text-gray-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:focus:border-blue-400 dark:disabled:bg-gray-900 dark:disabled:text-gray-500"
                />
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {formData.type === "blog"
                ? "Format: 001-slug.mdx (number prefix will be added if missing)"
                : "Format: 001-slug.mdx (number prefix will be added automatically)"}
              {currentPostId && " (Cannot change slug when editing)"}
            </p>
              </div>
            )}

            {/* Title */}
            <div>
              <label
                htmlFor="title"
                className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                Title
              </label>
              <input
                type="text"
                id="title"
                name="title"
                value={formData.title}
                onChange={handleTitleChange}
                placeholder="Enter a title..."
                className="w-full rounded-lg border border-gray-300 bg-white p-2 text-gray-900 transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:focus:border-blue-400"
              />
            </div>

            {/* Description */}
            <div>
              <label
                htmlFor="description"
                className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                Description
              </label>
              <textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                placeholder="Enter a description..."
                rows={3}
                className="w-full rounded-lg border border-gray-300 bg-white p-2 text-gray-900 transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:focus:border-blue-400"
              />
            </div>

            {/* Tags */}
            <div>
              <label
                htmlFor="tags"
                className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                Tags (comma-separated)
              </label>
              <input
                type="text"
                id="tags"
                name="tags"
                value={formData.tags}
                onChange={handleInputChange}
                placeholder="tag1, tag2, tag3"
                className="w-full rounded-lg border border-gray-300 bg-white p-2 text-gray-900 transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:focus:border-blue-400"
              />
            </div>

            {/* Image */}
            <div>
              <label
                htmlFor="image"
                className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                Image Path
              </label>
              <input
                type="text"
                id="image"
                name="image"
                value={formData.image}
                onChange={handleInputChange}
                placeholder="/src/assets/log/2025-07.webp"
                className="w-full rounded-lg border border-gray-300 bg-white p-2 text-gray-900 transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:focus:border-blue-400"
              />
            </div>

            {/* File Upload */}
            <div>
              <label
                htmlFor="fileUpload"
                className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                Upload Images
              </label>
              <input
                type="file"
                id="fileUpload"
                multiple
                accept="image/*"
                onChange={handleFileUpload}
                disabled={uploading}
                className="w-full rounded-lg border border-gray-300 bg-white p-2 text-sm text-gray-900 file:mr-4 file:rounded-lg file:border-0 file:bg-blue-50 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-blue-700 hover:file:bg-blue-100 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:file:bg-blue-900/30 dark:file:text-blue-300 dark:hover:file:bg-blue-900/50"
              />
              {uploading && (
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  Uploading...
                </p>
              )}

              {uploadedImages.length > 0 && (
                <div className="mt-4 space-y-2">
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Uploaded Images:
                  </p>
                  {uploadedImages.map((url, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 p-2 dark:border-gray-700 dark:bg-gray-800/50"
                    >
                      <code className="flex-1 break-all text-sm text-gray-800 dark:text-gray-200">
                        {url}
                      </code>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(url);
                          setMessage({
                            type: "success",
                            text: "Path copied to clipboard!",
                          });
                          setTimeout(() => setMessage(null), 2000);
                        }}
                        className="rounded-lg bg-blue-500 px-3 py-1 text-sm text-white transition-colors hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700"
                      >
                        Copy
                      </button>
                      <button
                        type="button"
                        onClick={() => insertImageIntoContent(url)}
                        className="rounded-lg bg-green-500 px-3 py-1 text-sm text-white transition-colors hover:bg-green-600 dark:bg-green-600 dark:hover:bg-green-700"
                      >
                        Insert
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Published */}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="published"
                name="published"
                checked={formData.published}
                onChange={handleInputChange}
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-500/20 dark:border-gray-600 dark:bg-gray-800 dark:focus:ring-blue-400/20"
              />
              <label
                htmlFor="published"
                className="text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                Published
              </label>
            </div>

            {/* Release Date */}
            <div>
              <label
                htmlFor="releaseDate"
                className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                Release Date
              </label>
              <input
                type="date"
                id="releaseDate"
                name="releaseDate"
                value={formData.releaseDate}
                onChange={handleInputChange}
                className="w-full rounded-lg border border-gray-300 bg-white p-2 text-gray-900 transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:focus:border-blue-400"
              />
            </div>

            {/* Content */}
            <div>
              <label
                htmlFor="content"
                className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                Content (Markdown)
              </label>
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                {/* Editor */}
                <div className="lg:col-span-2">
                  <textarea
                    id="content"
                    name="content"
                    value={formData.content}
                    onChange={handleInputChange}
                    rows={35}
                    className="w-full rounded-lg border border-gray-300 bg-white p-4 font-mono text-sm text-gray-900 transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:focus:border-blue-400"
                    placeholder="Write your content in Markdown here..."
                  />
                </div>
                {/* Preview */}
                <div>
                  <div className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                    Preview
                  </div>
                  <div className="prose prose-sm min-h-[500px] max-w-none rounded-lg border border-gray-300 bg-white p-4 dark:prose-invert prose-headings:text-gray-900 prose-p:text-gray-700 prose-a:text-blue-600 prose-strong:text-gray-900 prose-code:text-gray-800 prose-pre:bg-gray-100 dark:border-gray-600 dark:bg-gray-800 dark:prose-headings:text-gray-100 dark:prose-p:text-gray-300 dark:prose-a:text-blue-400 dark:prose-strong:text-gray-100 dark:prose-code:text-gray-200 dark:prose-pre:bg-gray-900">
                    <ReactMarkdown>
                      {formData.content || "*No content to preview*"}
                    </ReactMarkdown>
                  </div>
                </div>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={saving}
              className="w-full rounded-lg bg-blue-600 px-4 py-3 font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-400 disabled:hover:bg-gray-400 dark:bg-blue-500 dark:hover:bg-blue-600 dark:disabled:bg-gray-700"
            >
              {saving
                ? "Saving..."
                : currentPostId
                  ? "Update Content"
                  : "Save Content"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
