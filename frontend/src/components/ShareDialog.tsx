'use client';

import { FormEvent, useEffect, useState } from 'react';
import {
  getPeople,
  initials,
  invitePerson,
  revokeShareLink,
  type PeopleResponse,
  type SyncDocument,
} from '@/lib/api';

interface ShareDialogProps {
  document: SyncDocument;
  isOwner: boolean;
  onClose: () => void;
  onToken: (shareToken: string) => void;
}

export default function ShareDialog({ document, isOwner, onClose, onToken }: ShareDialogProps) {
  const [people, setPeople] = useState<PeopleResponse | null>(null);
  const [email, setEmail] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const data = await getPeople(document._id);
        if (!cancelled) setPeople(data);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load people');
      }
    })();
    return () => { cancelled = true; };
  }, [document._id]);

  const link = typeof window === 'undefined'
    ? ''
    : `${window.location.origin}/doc/${people?.shareToken || document.shareToken}`;

  const copy = async () => {
    await navigator.clipboard.writeText(link);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  const invite = async (event: FormEvent) => {
    event.preventDefault();
    setPending(true);
    setError('');
    try {
      const data = await invitePerson(document._id, email.trim());
      setPeople(data);
      setNote(data.message);
      setEmail('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not invite');
    } finally {
      setPending(false);
    }
  };

  const resetLink = async () => {
    setError('');
    try {
      const data = await revokeShareLink(document._id);
      onToken(data.shareToken);
      setPeople((current) => current ? { ...current, shareToken: data.shareToken } : current);
      setNote('Old link no longer works.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not reset the link');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-3 sm:items-center" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-labelledby="share-title"
        className="w-full max-w-lg rounded-3xl bg-paper p-5 text-ink shadow-2xl sm:p-6"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="share-title" className="font-serif text-3xl">Share this page</h2>
            <p className="mt-1 text-sm text-[#6f675d]">Anyone with the link can edit after they sign in.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-full px-3 py-1 text-sm text-[#6f675d] hover:bg-[#efe8dc]">Close</button>
        </div>

        <div className="mt-5 flex gap-2">
          <input readOnly value={link} className="min-w-0 flex-1 rounded-xl border border-line bg-white px-3 py-2 text-sm" />
          <button type="button" onClick={copy} className="rounded-xl bg-ink px-4 py-2 text-sm text-paper">
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
        <p className="mt-2 text-xs text-[#6f675d]">They can paste this link into Connect to join the page.</p>

        <form onSubmit={invite} className="mt-4 flex gap-2">
          <input
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="Invite by email"
            className="min-w-0 flex-1 rounded-xl border border-line bg-white px-3 py-2 text-sm outline-none focus:border-ink"
          />
          <button type="submit" disabled={pending} className="rounded-xl border border-ink px-4 py-2 text-sm">
            {pending ? '…' : 'Invite'}
          </button>
        </form>

        {note && <p className="mt-3 text-sm text-[#2f5d50]">{note}</p>}
        {error && <p className="mt-3 text-sm text-clay" role="alert">{error}</p>}

        <ul className="mt-5 space-y-2">
          {people && (
            <PersonRow person={people.owner} label="Owner" />
          )}
          {people?.collaborators.map((person) => (
            <PersonRow key={person._id} person={person} label="Can edit" />
          ))}
          {people?.invitedEmails.map((address) => (
            <li key={address} className="flex items-center justify-between rounded-2xl bg-white px-3 py-2 text-sm">
              <span>{address}</span>
              <span className="text-xs text-[#6f675d]">Invited</span>
            </li>
          ))}
        </ul>

        {isOwner && (
          <button type="button" onClick={resetLink} className="mt-5 text-sm text-clay">
            Reset link
          </button>
        )}
      </div>
    </div>
  );
}

function PersonRow({ person, label }: { person: { name: string; email: string; avatarColor: string }; label: string }) {
  return (
    <li className="flex items-center justify-between gap-3 rounded-2xl bg-white px-3 py-2">
      <div className="flex min-w-0 items-center gap-3">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs text-white" style={{ background: person.avatarColor }}>
          {initials(person.name)}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm">{person.name}</span>
          <span className="block truncate text-xs text-[#6f675d]">{person.email}</span>
        </span>
      </div>
      <span className="text-xs text-[#6f675d]">{label}</span>
    </li>
  );
}
