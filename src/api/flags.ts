import user from '../user';
import flags from '../flags';

interface Caller {
    uid: string | number;
}

interface FlagCreateData {
    type: string;
    id: string;
    reason: string;
}

interface FlagUpdateData {
    flagId: string;
    [key: string]: string;
}

interface FlagNoteData {
    flagId: string;
    datetime: Date;
    note: string;
}

interface Note {
    uid: number;
    [key: string]: number;
}

async function create(caller: Caller, data: FlagCreateData): Promise<Note> {
    const required = ['type', 'id', 'reason'];
    if (!required.every(prop => !!data[prop])) {
        throw new Error('[[error:invalid-data]]');
    }

    const { type, id, reason } = data;

    await flags.validate({
        uid: caller.uid,
        type: type,
        id: id,
    });

    const flagObj: Note = await flags.create(type, id, caller.uid, reason);
    void flags.notify(flagObj, caller.uid);

    return flagObj;
}

async function update(caller: Caller, data: FlagUpdateData): Promise<Note[]> {
    const allowed = await user.isPrivileged(caller.uid);
    if (!allowed) {
        throw new Error('[[error:no-privileges]]');
    }

    const { flagId } = data;
    delete data.flagId;

    await flags.update(flagId, caller.uid, data);
    return await flags.getHistory(flagId);
}

async function appendNote(caller: Caller, data: FlagNoteData): Promise<{ notes: Note[], history: Note[] }> {
    const allowed = await user.isPrivileged(caller.uid);
    if (!allowed) {
        throw new Error('[[error:no-privileges]]');
    }
    if (data.datetime && data.flagId) {
        try {
            const note: Note = await flags.getNote(data.flagId, data.datetime);
            if (note.uid !== caller.uid) {
                throw new Error('[[error:no-privileges]]');
            }
        } catch (e) {
            if (e.message !== '[[error:invalid-data]]') {
                throw e;
            }
        }
    }
    await flags.appendNote(data.flagId, caller.uid, data.note, data.datetime);
    const [notes, history]: [Note[], Note[]] = await Promise.all([
        flags.getNotes(data.flagId),
        flags.getHistory(data.flagId),
    ]);
    return { notes, history };
}

async function deleteNote(caller: Caller, data: FlagNoteData): Promise<{ notes: Note[], history: Note[] }> {
    const note: Note = await flags.getNote(data.flagId, data.datetime);
    if (note.uid !== caller.uid) {
        throw new Error('[[error:no-privileges]]');
    }

    await flags.deleteNote(data.flagId, data.datetime);
    await flags.appendHistory(data.flagId, caller.uid, {
        notes: '[[flags:note-deleted]]',
        datetime: Date.now().toString(),
    });

    const [notes, history]: [Note[], Note[]] = await Promise.all([
        flags.getNotes(data.flagId),
        flags.getHistory(data.flagId),
    ]);
    return { notes, history };
}

export {
    create,
    update,
    appendNote,
    deleteNote,
};
