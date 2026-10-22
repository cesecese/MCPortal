'use client';

import { useMemo, useRef, useState, type FormEvent } from 'react';
import { discussionFor } from '../data/discussions';
import type { DiscussionComment, Mcp } from '../data/types';
import { cx, relativeTime } from '../lib/format';
import { useStore } from '../store/store';
import { useToast } from '../store/toast';
import { Avatar } from './primitives';

const ROLE_LABEL = {
  owner: 'Propietario',
  author: 'Autor',
  contributor: 'Colaborador',
} as const;

function addReply(list: DiscussionComment[], parentId: string, entry: DiscussionComment): DiscussionComment[] {
  return list.map((comment) => {
    if (comment.id === parentId) {
      return { ...comment, replies: [...(comment.replies ?? []), entry] };
    }
    if (comment.replies?.length) {
      return { ...comment, replies: addReply(comment.replies, parentId, entry) };
    }
    return comment;
  });
}

function countMessages(list: DiscussionComment[]): number {
  return list.reduce((total, comment) => total + 1 + countMessages(comment.replies ?? []), 0);
}

function CommentItem({
  comment,
  depth = 0,
  onReply,
}: {
  comment: DiscussionComment;
  depth?: number;
  onReply: (comment: DiscussionComment) => void;
}) {
  return (
    <li className={cx('comment', depth > 0 && 'comment--reply')}>
      <Avatar name={comment.author} size={depth > 0 ? 26 : 32} />
      <div className="comment__content">
        <div className="comment__head">
          <strong>{comment.author}</strong>
          {comment.role && <span className="tag tag--ink">{ROLE_LABEL[comment.role]}</span>}
          <span className="comment__time">{relativeTime(comment.createdAt)}</span>
        </div>
        <p className="comment__body">{comment.body}</p>
        <button className="comment__reply" type="button" onClick={() => onReply(comment)}>
          Responder
        </button>
        {comment.replies?.length ? (
          <ul className="comment__replies">
            {comment.replies.map((reply) => (
              <CommentItem key={reply.id} comment={reply} depth={depth + 1} onReply={onReply} />
            ))}
          </ul>
        ) : null}
      </div>
    </li>
  );
}

/** Hilo de discusión de demostración + comentarios guardados en el navegador. */
export function Comments({ mcp }: { mcp: Mcp }) {
  const { commentsFor, addComment } = useStore();
  const notify = useToast();
  const local = commentsFor(mcp.id);
  const seeded = useMemo(() => discussionFor(mcp), [mcp]);
  const [body, setBody] = useState('');
  const [replyTo, setReplyTo] = useState<DiscussionComment | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const thread = useMemo(() => {
    let next = seeded;
    for (const entry of local) {
      if (entry.parentId) {
        next = addReply(next, entry.parentId, entry);
      } else {
        next = [...next, entry];
      }
    }
    return next;
  }, [seeded, local]);

  const total = countMessages(thread);

  const startReply = (comment: DiscussionComment) => {
    setReplyTo(comment);
    window.requestAnimationFrame(() => inputRef.current?.focus());
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const clean = body.trim();
    if (!clean) return;
    addComment(mcp.id, clean, replyTo?.id);
    setBody('');
    setReplyTo(null);
    notify('Comentario publicado', { detail: 'visible en esta ficha de demostración', icon: 'check' });
  };

  return (
    <section className="comments detail__section" aria-labelledby="comments-title">
      <div className="section-head">
        <h2 id="comments-title">Comentarios y discusiones</h2>
        <span className="section-head__meta">
          {total} {total === 1 ? 'mensaje' : 'mensajes'} · hilo de demostración
        </span>
      </div>

      <ul className="comments__thread">
        {thread.map((comment) => (
          <CommentItem key={comment.id} comment={comment} onReply={startReply} />
        ))}
      </ul>

      <form className="comment-form" onSubmit={submit}>
        <div className="comment-form__head">
          <Avatar name="Tú" size={28} />
          <div>
            <strong>Comentar como Tú</strong>
            <span>Los comentarios nuevos se guardan solo en este navegador.</span>
          </div>
        </div>
        {replyTo && (
          <div className="comment-form__reply">
            <span>
              Respondiendo a <strong>{replyTo.author}</strong>
            </span>
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => setReplyTo(null)}>
              Cancelar
            </button>
          </div>
        )}
        <textarea
          ref={inputRef}
          className="textarea"
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder={replyTo ? `Responde a ${replyTo.author}…` : 'Comparte cómo te ha funcionado este MCP…'}
          rows={3}
          aria-label="Escribe un comentario"
        />
        <div className="comment-form__foot">
          <span>Cita la versión si el problema depende de ella.</span>
          <button className="btn btn--primary btn--sm" type="submit" disabled={!body.trim()}>
            Publicar comentario
          </button>
        </div>
      </form>
    </section>
  );
}
