"use client";

import { useEffect, useRef, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import { Node } from "@tiptap/core";

import {
  Undo2,
  Redo2,
  Pilcrow,
  Heading1,
  Heading2,
  Heading3,
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Highlighter,
  Quote,
  List,
  ListOrdered,
  Link as LinkIcon,
  FileText,
  Image as ImageIcon,
  AudioLines,
  Video,
  Paperclip,
  Code,
  SquareCode,
  Minus,
} from "lucide-react";

import StarterKit from "@tiptap/starter-kit";
import UnderlineExtension from "@tiptap/extension-underline";
import Highlight from "@tiptap/extension-highlight";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import Image from "@tiptap/extension-image";

import { createClient } from "@/src/lib/supabase/client";

/* ============================================================
   FOOTNOTE REFERENCE
============================================================ */

const FootnoteReference = Node.create({
  name: "footnoteReference",

  inline: true,
  group: "inline",
  atom: true,
  selectable: false,

  addAttributes() {
    return {
      id: {
        default: null,
      },

      number: {
        default: 1,
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: "sup[data-footnote-id]",
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "sup",
      {
        "data-footnote-id":
          HTMLAttributes.id,

        class:
          "cursor-default select-none font-semibold align-super text-[0.7em] leading-none",
      },

      String(
        HTMLAttributes.number || 1
      ),
    ];
  },

  addCommands() {
    return {
      insertFootnoteReference:
        (attributes) =>
        ({ commands }) =>
          commands.insertContent({
            type: this.name,
            attrs: attributes,
          }),
    };
  },
});

/* ============================================================
   TOOLBAR BUTTON

   IMPORTANT:
   Formatting is executed on mouseDown.

   This prevents the browser from moving focus away from
   the editor before Tiptap receives the formatting command.
============================================================ */

function ToolbarButton({
  onClick,
  active = false,
  disabled = false,
  children,
  title,
}) {
  return (
    <button
      type="button"
      onMouseDown={(event) => {
        event.preventDefault();

        if (!disabled) {
          onClick?.(event);
        }
      }}
      disabled={disabled}
      title={title}
      aria-label={title}
      className={[
        "flex h-9 min-w-9 items-center justify-center rounded-md px-2 transition-colors",
        active
          ? "bg-dark text-light"
          : "hover:bg-dark/10",
        disabled
          ? "cursor-not-allowed opacity-30"
          : "",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

/* ============================================================
   TOOLBAR DIVIDER
============================================================ */

function ToolbarDivider() {
  return (
    <div className="mx-1 h-6 w-px bg-dark/10" />
  );
}

/* ============================================================
   FOOTNOTE EDITOR
============================================================ */

function FootnoteEditor({
  footnote,
  onChange,
}) {
  const editorRef = useRef(null);

  useEffect(() => {
    if (!editorRef.current) {
      return;
    }

    const current =
      editorRef.current.innerHTML;

    const incoming =
      footnote.html ??
      escapeHtml(
        footnote.text || ""
      );

    if (current !== incoming) {
      editorRef.current.innerHTML =
        incoming;
    }
  }, [
    footnote.id,
    footnote.html,
  ]);

  const execFormat = (command) => {
    if (!editorRef.current) {
      return;
    }

    editorRef.current.focus();

    document.execCommand(
      command,
      false,
      null
    );

    onChange(
      editorRef.current.innerHTML
    );
  };

  const handleInput = () => {
    if (!editorRef.current) {
      return;
    }

    onChange(
      editorRef.current.innerHTML
    );
  };

  return (
    <div className="min-w-0 flex-1">

      <div className="mb-2 flex items-center gap-1">

        <button
          type="button"
          onMouseDown={(event) =>
            event.preventDefault()
          }
          onClick={() =>
            execFormat("bold")
          }
          className="
            flex h-8 w-8
            items-center justify-center
            rounded-md
            border border-dark/10
            hover:bg-dark/10
          "
          title="Bold"
          aria-label="Bold"
        >
          <Bold
            size={15}
            strokeWidth={1.8}
          />
        </button>

        <button
          type="button"
          onMouseDown={(event) =>
            event.preventDefault()
          }
          onClick={() =>
            execFormat("italic")
          }
          className="
            flex h-8 w-8
            items-center justify-center
            rounded-md
            border border-dark/10
            hover:bg-dark/10
          "
          title="Italic"
          aria-label="Italic"
        >
          <Italic
            size={15}
            strokeWidth={1.8}
          />
        </button>

        <button
          type="button"
          onMouseDown={(event) =>
            event.preventDefault()
          }
          onClick={() =>
            execFormat("underline")
          }
          className="
            flex h-8 w-8
            items-center justify-center
            rounded-md
            border border-dark/10
            hover:bg-dark/10
          "
          title="Underline"
          aria-label="Underline"
        >
          <Underline
            size={15}
            strokeWidth={1.8}
          />
        </button>

      </div>

      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
        onBlur={handleInput}
        data-footnote-editor-id={
          footnote.id
        }
        className="
          min-h-[44px]
          w-full
          rounded-md
          border
          border-dark/10
          bg-transparent
          px-3
          py-2
          text-sm
          leading-6
          outline-none
          transition-colors
          focus:border-dark/30
          [&_em]:italic
          [&_i]:italic
          [&_strong]:font-bold
          [&_b]:font-bold
          [&_u]:underline
        "
      />

    </div>
  );
}

/* ============================================================
   MAIN EDITOR
============================================================ */

export default function RichTextEditor({
  value = "",
  onChange,
}) {
  const imageInputRef = useRef(null);
  const audioInputRef = useRef(null);
  const videoInputRef = useRef(null);
  const fileInputRef = useRef(null);

  const footnotesRef =
    useRef([]);

  const syncingRef =
    useRef(false);

  const lastLoadedValueRef =
    useRef(null);

  const [, forceEditorUpdate] =
    useState(0);

  const supabase =
    createClient();

  /* ==========================================================
     FOOTNOTE REFERENCES
  ========================================================== */

  const getFootnoteReferences = (
    doc
  ) => {
    const references = [];

    doc?.descendants(
      (node, position) => {
        if (
          node.type.name ===
          "footnoteReference"
        ) {
          references.push({
            id: node.attrs.id,
            number:
              node.attrs.number,
            position,
          });
        }
      }
    );

    return references;
  };

  /* ==========================================================
     RENUMBER FOOTNOTES
  ========================================================== */

  const renumberFootnoteReferences =
    (currentEditor) => {
      if (
        !currentEditor ||
        syncingRef.current
      ) {
        return;
      }

      const references =
        getFootnoteReferences(
          currentEditor.state.doc
        );

      let transaction =
        currentEditor.state.tr;

      let changed = false;

      references.forEach(
        (reference, index) => {
          const number =
            index + 1;

          if (
            reference.number !==
            number
          ) {
            const node =
              currentEditor.state.doc.nodeAt(
                reference.position
              );

            if (
              node &&
              node.type.name ===
                "footnoteReference"
            ) {
              transaction =
                transaction.setNodeMarkup(
                  reference.position,
                  undefined,
                  {
                    ...node.attrs,
                    number,
                  }
                );

              changed = true;
            }
          }
        }
      );

      if (changed) {
        syncingRef.current = true;

        currentEditor.view.dispatch(
          transaction
        );

        setTimeout(() => {
          syncingRef.current =
            false;

          forceEditorUpdate(
            (value) => value + 1
          );
        }, 0);
      }
    };

  /* ==========================================================
     SYNC FOOTNOTES
  ========================================================== */

  const syncFootnotes = (
    currentEditor
  ) => {
    if (!currentEditor) {
      return [];
    }

    const references =
      getFootnoteReferences(
        currentEditor.state.doc
      );

    const existing =
      footnotesRef.current;

    const cleaned =
      existing.filter(
        (footnote) =>
          references.some(
            (reference) =>
              reference.id ===
              footnote.id
          )
      );

    references.forEach(
      (reference) => {
        const alreadyExists =
          cleaned.some(
            (footnote) =>
              footnote.id ===
              reference.id
          );

        if (!alreadyExists) {
          cleaned.push({
            id: reference.id,
            text: "",
            html: "",
          });
        }
      }
    );

    const ordered =
      references
        .map((reference) =>
          cleaned.find(
            (footnote) =>
              footnote.id ===
              reference.id
          )
        )
        .filter(Boolean);

    const unique = [];
    const seen = new Set();

    ordered.forEach(
      (footnote) => {
        if (
          !seen.has(
            footnote.id
          )
        ) {
          seen.add(
            footnote.id
          );

          unique.push(
            footnote
          );
        }
      }
    );

    footnotesRef.current =
      unique;

    setFootnotesSafe(
      unique
    );

    return unique;
  };

  const setFootnotesSafe =
    (next) => {
      setFootnotes(next);

      forceEditorUpdate(
        (value) => value + 1
      );
    };

  /* ==========================================================
     EMIT CONTENT

     This DOES NOT cause the editor to reload.

     The parent may update "value" on every keystroke,
     but the editor-loading effect below checks whether
     the incoming content is actually different before
     calling setContent().
  ========================================================== */

  const emitChange = (
    currentEditor,
    nextFootnotes
  ) => {
    if (
      !currentEditor ||
      !onChange
    ) {
      return;
    }

    onChange(
      JSON.stringify({
        document:
          currentEditor.getJSON(),

        footnotes:
          nextFootnotes,
      })
    );
  };

  /* ==========================================================
     TIPTAP
  ========================================================== */

  const editor = useEditor({
    immediatelyRender: false,

    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
      }),

      UnderlineExtension,

      Highlight.configure({
        multicolor: true,
      }),

      /*
       * IMPORTANT:
       * inclusive: false means typing after a linked
       * selection will NOT keep extending the link.
       */
      Link.configure({
        openOnClick: false,
        autolink: true,
        defaultProtocol: "https",
        inclusive: false,
      }),

      Placeholder.configure({
        placeholder:
          "Start writing your article here...",
      }),

      Image.configure({
        inline: false,
        allowBase64: false,
      }),

      FootnoteReference,
    ],

    /*
     * The initial value is loaded here.
     *
     * After that, the editor is NOT blindly reset
     * every time the parent changes "value".
     */
    content:
      parseContent(value),

    editorProps: {
      attributes: {
        class:
          "prose prose-neutral max-w-none min-h-[650px] px-6 py-5 outline-none prose-headings:font-semibold prose-p:leading-7 prose-blockquote:border-l-2 prose-blockquote:border-dark/30 prose-blockquote:pl-5 prose-blockquote:italic prose-a:underline prose-a:underline-offset-2",
      },
    },

    onUpdate({
      editor: currentEditor,
    }) {
      if (
        syncingRef.current
      ) {
        return;
      }

      const nextFootnotes =
        syncFootnotes(
          currentEditor
        );

      renumberFootnoteReferences(
        currentEditor
      );

      emitChange(
        currentEditor,
        nextFootnotes
      );
    },
  });

  /* ==========================================================
     FORCE TOOLBAR TO REFLECT EDITOR STATE
  ========================================================== */

  useEffect(() => {
    if (!editor) {
      return;
    }

    const updateToolbar =
      () => {
        forceEditorUpdate(
          (value) => value + 1
        );
      };

    editor.on(
      "selectionUpdate",
      updateToolbar
    );

    editor.on(
      "transaction",
      updateToolbar
    );

    return () => {
      editor.off(
        "selectionUpdate",
        updateToolbar
      );

      editor.off(
        "transaction",
        updateToolbar
      );
    };
  }, [editor]);

  /* ==========================================================
     LOAD / SYNCHRONIZE EXISTING CONTENT

     THIS IS THE IMPORTANT FIX.

     Previously:

       [editor, value]

     caused setContent() to run after EVERY keystroke.

     Now we only replace the editor content if the
     incoming document is genuinely different from
     what is already inside Tiptap.

     This means:

       click Heading 1
       type "Hello"

     stays:

       <H1>Hello</H1>

     instead of resetting the cursor/selection.
  ========================================================== */

  useEffect(() => {
    if (!editor) {
      return;
    }

    /*
     * No external value:
     * Nothing to synchronize.
     */
    if (!value) {
      return;
    }

    try {
      const parsed =
        JSON.parse(value);

      let incomingDocument = null;
      let incomingFootnotes = [];

      if (
        parsed?.document?.type ===
        "doc"
      ) {
        incomingDocument =
          parsed.document;

        incomingFootnotes =
          Array.isArray(
            parsed.footnotes
          )
            ? parsed.footnotes
            : [];
      } else if (
        parsed?.type ===
        "doc"
      ) {
        incomingDocument =
          parsed;

        incomingFootnotes = [];
      }

      if (!incomingDocument) {
        return;
      }

      /*
       * Compare the actual document JSON.
       *
       * If the parent merely gave us the value that
       * WE just emitted, this comparison is equal and
       * we do nothing.
       *
       * That is what prevents the cursor from being
       * destroyed on every keystroke.
       */
      const currentDocument =
        editor.getJSON();

      const currentDocumentString =
        JSON.stringify(
          currentDocument
        );

      const incomingDocumentString =
        JSON.stringify(
          incomingDocument
        );

      const documentIsDifferent =
        currentDocumentString !==
        incomingDocumentString;

      /*
       * Only call setContent when the actual document
       * changed externally.
       */
      if (documentIsDifferent) {
        syncingRef.current =
          true;

        editor.commands.setContent(
          incomingDocument,
          false
        );

        setTimeout(() => {
          syncingRef.current =
            false;
        }, 0);
      }

      /*
       * Synchronize footnotes without resetting the
       * editor whenever the parent rerenders.
       */
      const unique = [];
      const seen = new Set();

      incomingFootnotes.forEach(
        (footnote) => {
          if (
            footnote?.id &&
            !seen.has(
              footnote.id
            )
          ) {
            seen.add(
              footnote.id
            );

            unique.push({
              id: footnote.id,

              text:
                footnote.text ||
                "",

              html:
                footnote.html ||
                escapeHtml(
                  footnote.text ||
                  ""
                ),
            });
          }
        }
      );

      footnotesRef.current =
        unique;

      setFootnotes(
        unique
      );

      lastLoadedValueRef.current =
        value;

      forceEditorUpdate(
        (value) => value + 1
      );

    } catch {
      /*
       * Ignore invalid or old content.
       */
    }
  }, [
    editor,
    value,
  ]);

  /* ==========================================================
     FOOTNOTES STATE
  ========================================================== */

  const [footnotes, setFootnotes] =
    useState([]);

  /* ==========================================================
     ADD FOOTNOTE
  ========================================================== */

  const addFootnote = () => {
    if (!editor) {
      return;
    }

    let id =
      crypto.randomUUID();

    const existingIds =
      new Set(
        footnotesRef.current.map(
          (footnote) =>
            footnote.id
        )
      );

    while (
      existingIds.has(id)
    ) {
      id =
        crypto.randomUUID();
    }

    const number =
      getFootnoteReferences(
        editor.state.doc
      ).length + 1;

    editor
      .chain()
      .focus()
      .insertContent({
        type:
          "footnoteReference",

        attrs: {
          id,
          number,
        },
      })
      .run();

    const next = [
      ...footnotesRef.current.filter(
        (footnote) =>
          footnote.id !== id
      ),

      {
        id,
        text: "",
        html: "",
      },
    ];

    footnotesRef.current =
      next;

    setFootnotes(next);

    setTimeout(() => {
      document
        .querySelector(
          `[data-footnote-editor-id="${id}"]`
        )
        ?.focus();
    }, 100);
  };

  /* ==========================================================
     UPDATE FOOTNOTE
  ========================================================== */

  const updateFootnote = (
    id,
    html
  ) => {
    const next =
      footnotesRef.current.map(
        (footnote) =>
          footnote.id === id
            ? {
                ...footnote,

                html,

                text:
                  htmlToPlainText(
                    html
                  ),
              }
            : footnote
      );

    footnotesRef.current =
      next;

    setFootnotes(next);

    emitChange(
      editor,
      next
    );
  };

  /* ==========================================================
     DELETE FOOTNOTE
  ========================================================== */

  const deleteFootnote = (
    id
  ) => {
    if (!editor) {
      return;
    }

    const references =
      getFootnoteReferences(
        editor.state.doc
      );

    const reference =
      references.find(
        (item) =>
          item.id === id
      );

    if (reference) {
      const node =
        editor.state.doc.nodeAt(
          reference.position
        );

      if (node) {
        syncingRef.current =
          true;

        const transaction =
          editor.state.tr.delete(
            reference.position,
            reference.position +
              node.nodeSize
          );

        editor.view.dispatch(
          transaction
        );

        const remaining =
          footnotesRef.current.filter(
            (footnote) =>
              footnote.id !== id
          );

        footnotesRef.current =
          remaining;

        setFootnotes(
          remaining
        );

        setTimeout(() => {
          syncingRef.current =
            false;

          renumberFootnoteReferences(
            editor
          );

          emitChange(
            editor,
            remaining
          );

          forceEditorUpdate(
            (value) => value + 1
          );
        }, 0);

        return;
      }
    }

    const remaining =
      footnotesRef.current.filter(
        (footnote) =>
          footnote.id !== id
      );

    footnotesRef.current =
      remaining;

    setFootnotes(
      remaining
    );

    emitChange(
      editor,
      remaining
    );
  };

  /* ==========================================================
     LINK
  ========================================================== */

  const addLink = () => {
    if (!editor) {
      return;
    }

    const previousUrl =
      editor.getAttributes(
        "link"
      ).href || "";

    const url =
      window.prompt(
        "Enter the URL:",
        previousUrl
      );

    if (url === null) {
      return;
    }

    /*
     * Empty URL = remove link.
     */
    if (!url.trim()) {
      editor
        .chain()
        .focus()
        .extendMarkRange(
          "link"
        )
        .unsetLink()
        .run();

      return;
    }

    let finalUrl =
      url.trim();

    if (
      !finalUrl.startsWith(
        "http://"
      ) &&
      !finalUrl.startsWith(
        "https://"
      ) &&
      !finalUrl.startsWith(
        "mailto:"
      )
    ) {
      finalUrl =
        `https://${finalUrl}`;
    }

    editor
      .chain()
      .focus()
      .extendMarkRange(
        "link"
      )
      .setLink({
        href: finalUrl,
      })
      .run();
  };

  /* ==========================================================
     FILE VALIDATION
  ========================================================== */

  const validateFile = (
    file,
    allowedTypes,
    maxSize,
    typeName
  ) => {
    if (!file) {
      return false;
    }

    if (
      allowedTypes.length > 0 &&
      !allowedTypes.includes(
        file.type
      )
    ) {
      window.alert(
        `Please choose a valid ${typeName} file.`
      );

      return false;
    }

    if (
      file.size >
      maxSize
    ) {
      window.alert(
        `${typeName} files must be smaller than ${
          maxSize /
          (1024 * 1024)
        } MB.`
      );

      return false;
    }

    return true;
  };

  /* ==========================================================
     SUPABASE UPLOAD
  ========================================================== */

  const uploadToSupabase =
    async (
      file,
      bucket,
      folder
    ) => {
      const extension =
        file.name.includes(".")
          ? file.name
              .split(".")
              .pop()
              .toLowerCase()
          : "bin";

      const fileName =
        `${crypto.randomUUID()}.${extension}`;

      const path =
        `${folder}/${fileName}`;

      const {
        error: uploadError,
      } =
        await supabase.storage
          .from(bucket)
          .upload(
            path,
            file,
            {
              cacheControl:
                "3600",

              upsert:
                false,
            }
          );

      if (uploadError) {
        throw new Error(
          uploadError.message ||
            "Upload failed."
        );
      }

      const {
        data: publicData,
      } =
        supabase.storage
          .from(bucket)
          .getPublicUrl(
            path
          );

      if (
        !publicData?.publicUrl
      ) {
        throw new Error(
          "Could not create a public URL."
        );
      }

      return publicData.publicUrl;
    };

  /* ==========================================================
     IMAGE
  ========================================================== */

  const handleImage =
    async (event) => {
      const file =
        event.target.files?.[0];

      event.target.value = "";

      if (
        !file ||
        !editor
      ) {
        return;
      }

      if (
        !validateFile(
          file,

          [
            "image/jpeg",
            "image/png",
            "image/webp",
            "image/gif",
          ],

          10 *
            1024 *
            1024,

          "image"
        )
      ) {
        return;
      }

      try {
        const url =
          await uploadToSupabase(
            file,
            "blog-images",
            "content"
          );

        editor
          .chain()
          .focus()
          .setImage({
            src: url,
            alt: file.name,
          })
          .run();
      } catch (error) {
        window.alert(
          error.message ||
            "Could not upload image."
        );
      }
    };

  /* ==========================================================
     AUDIO
  ========================================================== */

  const handleAudio =
    async (event) => {
      const file =
        event.target.files?.[0];

      event.target.value = "";

      if (
        !file ||
        !editor
      ) {
        return;
      }

      if (
        !validateFile(
          file,

          [
            "audio/mpeg",
            "audio/mp3",
            "audio/wav",
            "audio/x-wav",
            "audio/mp4",
            "audio/x-m4a",
            "audio/ogg",
          ],

          50 *
            1024 *
            1024,

          "audio"
        )
      ) {
        return;
      }

      try {
        const url =
          await uploadToSupabase(
            file,
            "blog-audio",
            "content"
          );

        editor
          .chain()
          .focus()
          .insertContent([
            {
              type:
                "paragraph",

              content: [
                {
                  type:
                    "text",

                  text:
                    file.name,

                  marks: [
                    {
                      type:
                        "bold",
                    },
                  ],
                },
              ],
            },

            {
              type:
                "paragraph",

              content: [
                {
                  type:
                    "text",

                  text:
                    "Open audio recording",

                  marks: [
                    {
                      type:
                        "link",

                      attrs: {
                        href:
                          url,
                      },
                    },
                  ],
                },
              ],
            },
          ])
          .run();
      } catch (error) {
        window.alert(
          error.message ||
            "Could not upload audio."
        );
      }
    };

  /* ==========================================================
     VIDEO
  ========================================================== */

  const handleVideo =
    async (event) => {
      const file =
        event.target.files?.[0];

      event.target.value = "";

      if (
        !file ||
        !editor
      ) {
        return;
      }

      if (
        !validateFile(
          file,

          [
            "video/mp4",
            "video/webm",
            "video/ogg",
            "video/quicktime",
          ],

          250 *
            1024 *
            1024,

          "video"
        )
      ) {
        return;
      }

      try {
        const url =
          await uploadToSupabase(
            file,
            "blog-video",
            "content"
          );

        editor
          .chain()
          .focus()
          .insertContent([
            {
              type:
                "paragraph",

              content: [
                {
                  type:
                    "text",

                  text:
                    file.name,

                  marks: [
                    {
                      type:
                        "bold",
                    },
                  ],
                },
              ],
            },

            {
              type:
                "paragraph",

              content: [
                {
                  type:
                    "text",

                  text:
                    "Open video",

                  marks: [
                    {
                      type:
                        "link",

                      attrs: {
                        href:
                          url,
                      },
                    },
                  ],
                },
              ],
            },
          ])
          .run();
      } catch (error) {
        window.alert(
          error.message ||
            "Could not upload video."
        );
      }
    };

  /* ==========================================================
     FILE
  ========================================================== */

  const handleFile =
    async (event) => {
      const file =
        event.target.files?.[0];

      event.target.value = "";

      if (
        !file ||
        !editor
      ) {
        return;
      }

      if (
        !validateFile(
          file,

          [
            "application/pdf",
            "application/msword",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "text/plain",
            "text/csv",
          ],

          25 *
            1024 *
            1024,

          "document"
        )
      ) {
        return;
      }

      try {
        const url =
          await uploadToSupabase(
            file,
            "blog-files",
            "content"
          );

        editor
          .chain()
          .focus()
          .insertContent([
            {
              type:
                "paragraph",

              content: [
                {
                  type:
                    "text",

                  text:
                    file.name,

                  marks: [
                    {
                      type:
                        "bold",
                    },
                  ],
                },
              ],
            },

            {
              type:
                "paragraph",

              content: [
                {
                  type:
                    "text",

                  text:
                    "Open attachment",

                  marks: [
                    {
                      type:
                        "link",

                      attrs: {
                        href:
                          url,
                      },
                    },
                  ],
                },
              ],
            },
          ])
          .run();
      } catch (error) {
        window.alert(
          error.message ||
            "Could not upload file."
        );
      }
    };

  /* ==========================================================
     LOADING
  ========================================================== */

  if (!editor) {
    return (
      <div className="overflow-hidden rounded-2xl border border-dark/20">

        <div className="flex min-h-12 items-center border-b border-dark/10 bg-dark/[0.03] px-4">

          <span className="text-xs opacity-50">
            Loading editor...
          </span>

        </div>

        <div className="min-h-[650px]" />

      </div>
    );
  }

  /* ==========================================================
     UI
  ========================================================== */

  return (
    <div className="overflow-hidden rounded-2xl border border-dark/20">

      {/* HIDDEN FILE INPUTS */}

      <input
        ref={imageInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={handleImage}
      />

      <input
        ref={audioInputRef}
        type="file"
        accept="audio/*"
        className="hidden"
        onChange={handleAudio}
      />

      <input
        ref={videoInputRef}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={handleVideo}
      />

      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.doc,.docx,.txt,.csv"
        className="hidden"
        onChange={handleFile}
      />

      {/* ======================================================
          MAIN TOOLBAR
      ======================================================= */}

      <div className="flex flex-wrap items-center gap-1 border-b border-dark/10 bg-dark/[0.03] p-2">

        <ToolbarButton
          onClick={() =>
            editor
              .chain()
              .focus()
              .undo()
              .run()
          }
          disabled={
            !editor.can().undo()
          }
          title="Undo"
        >
          <Undo2
            size={17}
            strokeWidth={1.8}
          />
        </ToolbarButton>

        <ToolbarButton
          onClick={() =>
            editor
              .chain()
              .focus()
              .redo()
              .run()
          }
          disabled={
            !editor.can().redo()
          }
          title="Redo"
        >
          <Redo2
            size={17}
            strokeWidth={1.8}
          />
        </ToolbarButton>

        <ToolbarDivider />

        <ToolbarButton
          onClick={() =>
            editor
              .chain()
              .focus()
              .setParagraph()
              .run()
          }
          title="Normal text"
        >
          <Pilcrow
            size={17}
            strokeWidth={1.8}
          />
        </ToolbarButton>

        <ToolbarButton
          onClick={() =>
            editor
              .chain()
              .focus()
              .toggleHeading({
                level: 1,
              })
              .run()
          }
          active={editor.isActive(
            "heading",
            {
              level: 1,
            }
          )}
          title="Heading 1"
        >
          <Heading1
            size={17}
            strokeWidth={1.8}
          />
        </ToolbarButton>

        <ToolbarButton
          onClick={() =>
            editor
              .chain()
              .focus()
              .toggleHeading({
                level: 2,
              })
              .run()
          }
          active={editor.isActive(
            "heading",
            {
              level: 2,
            }
          )}
          title="Heading 2"
        >
          <Heading2
            size={17}
            strokeWidth={1.8}
          />
        </ToolbarButton>

        <ToolbarButton
          onClick={() =>
            editor
              .chain()
              .focus()
              .toggleHeading({
                level: 3,
              })
              .run()
          }
          active={editor.isActive(
            "heading",
            {
              level: 3,
            }
          )}
          title="Heading 3"
        >
          <Heading3
            size={17}
            strokeWidth={1.8}
          />
        </ToolbarButton>

        <ToolbarDivider />

        <ToolbarButton
          onClick={() =>
            editor
              .chain()
              .focus()
              .toggleBold()
              .run()
          }
          active={editor.isActive(
            "bold"
          )}
          title="Bold"
        >
          <Bold
            size={17}
            strokeWidth={1.8}
          />
        </ToolbarButton>

        <ToolbarButton
          onClick={() =>
            editor
              .chain()
              .focus()
              .toggleItalic()
              .run()
          }
          active={editor.isActive(
            "italic"
          )}
          title="Italic"
        >
          <Italic
            size={17}
            strokeWidth={1.8}
          />
        </ToolbarButton>

        <ToolbarButton
          onClick={() =>
            editor
              .chain()
              .focus()
              .toggleUnderline()
              .run()
          }
          active={editor.isActive(
            "underline"
          )}
          title="Underline"
        >
          <Underline
            size={17}
            strokeWidth={1.8}
          />
        </ToolbarButton>

        <ToolbarButton
          onClick={() =>
            editor
              .chain()
              .focus()
              .toggleStrike()
              .run()
          }
          active={editor.isActive(
            "strike"
          )}
          title="Strikethrough"
        >
          <Strikethrough
            size={17}
            strokeWidth={1.8}
          />
        </ToolbarButton>

        <ToolbarButton
          onClick={() =>
            editor
              .chain()
              .focus()
              .toggleHighlight()
              .run()
          }
          active={editor.isActive(
            "highlight"
          )}
          title="Highlight"
        >
          <Highlighter
            size={17}
            strokeWidth={1.8}
          />
        </ToolbarButton>

        <ToolbarDivider />

        <ToolbarButton
          onClick={() =>
            editor
              .chain()
              .focus()
              .toggleBlockquote()
              .run()
          }
          active={editor.isActive(
            "blockquote"
          )}
          title="Quote"
        >
          <Quote
            size={17}
            strokeWidth={1.8}
          />
        </ToolbarButton>

        <ToolbarButton
          onClick={() =>
            editor
              .chain()
              .focus()
              .toggleBulletList()
              .run()
          }
          active={editor.isActive(
            "bulletList"
          )}
          title="Bullet list"
        >
          <List
            size={17}
            strokeWidth={1.8}
          />
        </ToolbarButton>

        <ToolbarButton
          onClick={() =>
            editor
              .chain()
              .focus()
              .toggleOrderedList()
              .run()
          }
          active={editor.isActive(
            "orderedList"
          )}
          title="Numbered list"
        >
          <ListOrdered
            size={17}
            strokeWidth={1.8}
          />
        </ToolbarButton>

        <ToolbarDivider />

        <ToolbarButton
          onClick={addLink}
          active={editor.isActive(
            "link"
          )}
          title="Add link"
        >
          <LinkIcon
            size={17}
            strokeWidth={1.8}
          />
        </ToolbarButton>

        <ToolbarButton
          onClick={addFootnote}
          title="Add footnote"
        >
          <FileText
            size={17}
            strokeWidth={1.8}
          />
        </ToolbarButton>

        <ToolbarButton
          onClick={() =>
            imageInputRef.current?.click()
          }
          title="Insert image"
        >
          <ImageIcon
            size={17}
            strokeWidth={1.8}
          />
        </ToolbarButton>

        <ToolbarButton
          onClick={() =>
            audioInputRef.current?.click()
          }
          title="Insert audio"
        >
          <AudioLines
            size={17}
            strokeWidth={1.8}
          />
        </ToolbarButton>

        <ToolbarButton
          onClick={() =>
            videoInputRef.current?.click()
          }
          title="Insert video"
        >
          <Video
            size={17}
            strokeWidth={1.8}
          />
        </ToolbarButton>

        <ToolbarButton
          onClick={() =>
            fileInputRef.current?.click()
          }
          title="Attach file"
        >
          <Paperclip
            size={17}
            strokeWidth={1.8}
          />
        </ToolbarButton>

        <ToolbarDivider />

        <ToolbarButton
          onClick={() =>
            editor
              .chain()
              .focus()
              .toggleCode()
              .run()
          }
          active={editor.isActive(
            "code"
          )}
          title="Inline code"
        >
          <Code
            size={17}
            strokeWidth={1.8}
          />
        </ToolbarButton>

        <ToolbarButton
          onClick={() =>
            editor
              .chain()
              .focus()
              .toggleCodeBlock()
              .run()
          }
          active={editor.isActive(
            "codeBlock"
          )}
          title="Code block"
        >
          <SquareCode
            size={17}
            strokeWidth={1.8}
          />
        </ToolbarButton>

        <ToolbarButton
          onClick={() =>
            editor
              .chain()
              .focus()
              .setHorizontalRule()
              .run()
          }
          title="Horizontal divider"
        >
          <Minus
            size={18}
            strokeWidth={1.8}
          />
        </ToolbarButton>

      </div>

      {/* ARTICLE EDITOR */}

      <EditorContent
        editor={editor}
      />

      {/* FOOTNOTES */}

      <div className="mx-6 border-t border-dark/20 py-8">

        <div className="mb-6">

          <h3 className="text-lg font-semibold">
            Footnotes
          </h3>

          <p className="mt-1 text-sm opacity-50">
            Citations and references for this article.
          </p>

        </div>

        {footnotes.length ===
        0 ? (

          <p className="text-sm opacity-40">
            No footnotes yet. Use the
            footnote button above to add one.
          </p>

        ) : (

          <div className="space-y-6">

            {footnotes.map(
              (
                footnote,
                index
              ) => (

                <div
                  key={`${footnote.id}-${index}`}
                  className="
                    flex
                    items-start
                    gap-4
                  "
                >

                  <div
                    className="
                      flex
                      h-8
                      w-8
                      shrink-0
                      items-center
                      justify-center
                      rounded-full
                      bg-dark/[0.06]
                      text-sm
                      font-semibold
                    "
                  >
                    {index + 1}
                  </div>

                  <FootnoteEditor
                    footnote={
                      footnote
                    }
                    onChange={(
                      html
                    ) =>
                      updateFootnote(
                        footnote.id,
                        html
                      )
                    }
                  />

                  <button
                    type="button"
                    onClick={() =>
                      deleteFootnote(
                        footnote.id
                      )
                    }
                    className="
                      flex
                      h-8
                      shrink-0
                      items-center
                      justify-center
                      rounded-md
                      border
                      border-red-500/20
                      px-3
                      text-xs
                      font-medium
                      text-red-600
                      transition-colors
                      hover:bg-red-500/10
                    "
                    title="Delete footnote"
                  >
                    Delete
                  </button>

                </div>

              )
            )}

          </div>

        )}

      </div>

    </div>
  );
}

/* ============================================================
   HELPERS
============================================================ */

function escapeHtml(
  text
) {
  if (!text) {
    return "";
  }

  return text
    .replace(
      /&/g,
      "&amp;"
    )
    .replace(
      /</g,
      "&lt;"
    )
    .replace(
      />/g,
      "&gt;"
    )
    .replace(
      /"/g,
      "&quot;"
    )
    .replace(
      /'/g,
      "&#039;"
    )
    .replace(
      /\n/g,
      "<br>"
    );
}

function htmlToPlainText(
  html
) {
  if (!html) {
    return "";
  }

  const temporary =
    document.createElement(
      "div"
    );

  temporary.innerHTML =
    html;

  return (
    temporary.textContent ||
    temporary.innerText ||
    ""
  );
}

function parseContent(
  value
) {
  if (!value) {
    return "";
  }

  try {
    const parsed =
      JSON.parse(value);

    if (
      parsed?.document?.type ===
      "doc"
    ) {
      return parsed.document;
    }

    if (
      parsed?.type ===
      "doc"
    ) {
      return parsed;
    }

    return "";
  } catch {
    return "";
  }
}