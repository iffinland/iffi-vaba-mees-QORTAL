import { createElement, useEffect, useMemo, useRef, useState } from 'react';
import { FaDownload, FaExpand, FaFileArchive, FaFileAlt, FaImage, FaPlay } from 'react-icons/fa';
import { getQdnResourceUrl, waitForQdnResourceReady } from '../../services/qdnResourceService';
import { requestQortal } from '../../utils/qortalClient';
import { sanitizeHtml } from '../../utils/htmlSanitizer';
import { ATTACHMENT_SERVICES, readAttachment } from '../../utils/richTextAttachments';
import styles from './RichTextContent.module.css';

const PREVIEW_BYTES = 65536;
const WORD_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';

const loadResource = async (location) => {
  let url = await getQdnResourceUrl(location);
  if (!url) {
    await waitForQdnResourceReady({ ...location, timeoutMs: 15000 });
    url = await getQdnResourceUrl(location);
  }
  if (url && /^(?:https?:\/\/|\/[^/])/i.test(url)) return url;
  throw new Error('The attachment is not available from your Qortal node yet.');
};

const readTextPreview = async (url, filename) => {
  const response = await fetch(url);
  if (!response.ok) throw new Error('Unable to load this document.');
  if (/\.docx$/i.test(filename)) {
    const { unzipSync } = await import('fflate');
    const entries = unzipSync(new Uint8Array(await response.arrayBuffer()), {
      filter: (entry) => entry.name === 'word/document.xml' && entry.originalSize <= 2 * 1024 * 1024,
    });
    const documentXml = entries['word/document.xml'];
    if (!documentXml) throw new Error('This Word document is invalid or too large to preview.');
    const xml = new DOMParser().parseFromString(new TextDecoder().decode(documentXml), 'application/xml');
    const paragraphs = Array.from(xml.getElementsByTagNameNS(WORD_NS, 'p'));
    return paragraphs.map((paragraph) => Array.from(paragraph.getElementsByTagNameNS(WORD_NS, 't'), (part) => part.textContent).join(''))
      .join('\n').slice(0, PREVIEW_BYTES);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let text = '';
  let remaining = PREVIEW_BYTES;
  try {
    while (remaining) {
      const { done, value } = await reader.read();
      if (done) return text + decoder.decode();
      text += decoder.decode(value.subarray(0, remaining), { stream: true });
      remaining -= Math.min(remaining, value.length);
    }
    return text + decoder.decode() + '\n…';
  } finally {
    await reader.cancel().catch(() => {});
  }
};

function PictureDialog({ url, filename, onClose }) {
  const dialogRef = useRef(null);
  useEffect(() => { dialogRef.current.showModal(); }, []);
  return (
    <dialog ref={dialogRef} className={styles.pictureDialog} onClose={onClose}
      onClick={(event) => { if (event.target === event.currentTarget) event.currentTarget.close(); }}>
      <button type="button" onClick={() => dialogRef.current.close()} aria-label="Close image">×</button>
      <img src={url} alt={filename} />
    </dialog>
  );
}

function Attachment({ attachment, authorName }) {
  const { id, kind, filename } = attachment;
  const isMedia = kind === 'image' || kind === 'video';
  const hostRef = useRef(null);
  const videoRef = useRef(null);
  const [nearby, setNearby] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [url, setUrl] = useState('');
  const [mediaFailed, setMediaFailed] = useState(false);
  const [view, setView] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState(null);
  const location = useMemo(() => ({
    service: ATTACHMENT_SERVICES[kind], name: authorName, identifier: id,
  }), [kind, authorName, id]);

  useEffect(() => {
    if (!isMedia || !authorName || !hostRef.current) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setNearby(true);
        observer.disconnect();
      }
    }, { rootMargin: '200px' });
    observer.observe(hostRef.current);
    return () => observer.disconnect();
  }, [isMedia, authorName]);

  useEffect(() => {
    if (!nearby || !isMedia) return;
    let active = true;
    loadResource(location).then(
      (result) => { if (active) setUrl(result); },
      () => { if (active) setMediaFailed(true); },
    );
    return () => { active = false; };
  }, [nearby, isMedia, location, loadAttempt]);

  const run = async (task) => {
    setBusy(true);
    setError('');
    try {
      await task();
    } catch (failure) {
      setError(failure?.message || 'Unable to open this attachment.');
    } finally {
      setBusy(false);
    }
  };

  const togglePreview = () => {
    if (preview !== null) setPreview(null);
    else void run(async () => setPreview(await readTextPreview(await loadResource(location), filename)));
  };

  const download = () => void run(async () => {
    // Delegate downloads to the host so they also work in a sandboxed mobile Q-App.
    const result = await requestQortal({ action: 'SAVE_FILE', filename, location });
    if (result?.error) throw new Error(result.error);
  });

  const fullscreen = () => void run(async () => {
    const player = videoRef.current;
    if (player.webkitEnterFullscreen) player.webkitEnterFullscreen();
    else if (player.requestFullscreen) await player.requestFullscreen();
    else throw new Error('Fullscreen is not available in this player.');
  });

  const retryMedia = () => {
    setUrl('');
    setMediaFailed(false);
    setLoadAttempt((current) => current + 1);
  };

  if (!authorName) return <span>{filename}</span>;

  return (
    <span ref={hostRef} className={styles.attachment}>
      {isMedia ? (
        <>
          {mediaFailed ? (
            <button type="button" onClick={retryMedia}>Retry loading {filename}</button>
          ) : !url ? (
            <span className={styles.placeholder}>
              {kind === 'image' ? <FaImage aria-hidden="true" /> : <FaPlay aria-hidden="true" />} {filename}
            </span>
          ) : kind === 'image' ? (
            <button className={styles.imageButton} type="button" aria-label={`Open image ${filename}`} onClick={() => setView(true)}>
              <img src={url} alt={filename} loading="lazy" onError={() => setMediaFailed(true)} />
            </button>
          ) : (
            <>
              <video ref={videoRef} controls playsInline preload="metadata" src={`${url.split('#')[0]}#t=0.001`}
                aria-label={filename} onError={() => setMediaFailed(true)} />
              <button type="button" onClick={fullscreen} aria-label={`Fullscreen ${filename}`}><FaExpand /> Fullscreen</button>
            </>
          )}
          {view && <PictureDialog url={url} filename={filename} onClose={() => setView(false)} />}
        </>
      ) : (
        <>
          <span className={styles.filename}>
            {kind === 'text' ? <FaFileAlt aria-hidden="true" /> : <FaFileArchive aria-hidden="true" />} {filename}
          </span>
          {kind === 'text' && (
            <button type="button" disabled={busy} onClick={togglePreview}>
              {preview === null ? 'Preview' : 'Hide preview'}
            </button>
          )}
          <button type="button" disabled={busy} onClick={download} aria-label={`Download ${filename}`}><FaDownload /> Download</button>
          {preview !== null && <span className={styles.textPreview}>{preview || 'This document is empty.'}</span>}
        </>
      )}
      {busy && <span role="status">Loading…</span>}
      {error && <span className={styles.error} role="alert">{error}</span>}
    </span>
  );
}

const renderNode = (node, key, authorName) => {
  if (node.nodeType === 3) return node.textContent;
  if (node.nodeType !== 1) return null;
  const attachment = readAttachment(node);
  if (attachment) return <Attachment key={`${key}-${attachment.id}-${authorName}`} attachment={attachment} authorName={authorName} />;
  const tag = node.localName === 'font' ? 'span' : node.localName;
  const props = {
    key,
    style: { color: node.style.color || undefined, backgroundColor: node.style.backgroundColor || undefined },
  };
  if (tag === 'a') {
    for (const name of ['href', 'title', 'target', 'rel']) {
      if (node.hasAttribute(name)) props[name] = node.getAttribute(name);
    }
  }
  if (tag === 'br' || tag === 'hr') return createElement(tag, props);
  return createElement(tag, props, Array.from(node.childNodes, (child, index) => renderNode(child, index, authorName)));
};

export default function RichTextContent({ html, authorName, className, fallback }) {
  const content = useMemo(() => {
    const template = document.createElement('template');
    template.innerHTML = sanitizeHtml(html);
    return Array.from(template.content.childNodes, (node, index) => renderNode(node, index, authorName));
  }, [html, authorName]);
  return <div className={className}>{content.length ? content : fallback}</div>;
}
