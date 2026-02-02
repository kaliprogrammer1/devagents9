import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const ROOT = process.cwd();

export async function POST(request: Request) {
  try {
    const { action, path: targetPath, content, name, type } = await request.json();

    const fullPath = path.join(ROOT, targetPath || '');
    if (!fullPath.startsWith(ROOT)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    switch (action) {
      case 'list': {
        const entries = await fs.readdir(fullPath, { withFileTypes: true });
        const files = entries.map(entry => ({
          id: path.join(targetPath || '', entry.name),
          name: entry.name,
          type: entry.isDirectory() ? 'folder' : 'file',
          // Note: we don't send children here to keep it simple, the client will fetch on demand
        }));
        return NextResponse.json({ files });
      }

      case 'read': {
        const fileContent = await fs.readFile(fullPath, 'utf-8');
        return NextResponse.json({ content: fileContent });
      }

      case 'write': {
        await fs.writeFile(fullPath, content || '');
        return NextResponse.json({ success: true });
      }

      case 'create': {
        if (type === 'folder') {
          await fs.mkdir(path.join(fullPath, name));
        } else {
          await fs.writeFile(path.join(fullPath, name), content || '');
        }
        return NextResponse.json({ success: true });
      }

      case 'delete': {
        const stats = await fs.stat(fullPath);
        if (stats.isDirectory()) {
          await fs.rm(fullPath, { recursive: true });
        } else {
          await fs.unlink(fullPath);
        }
        return NextResponse.json({ success: true });
      }

      case 'rename': {
        const { newName } = await request.json();
        const newPath = path.join(path.dirname(fullPath), newName);
        await fs.rename(fullPath, newPath);
        return NextResponse.json({ success: true });
      }

      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }
  } catch (error: any) {
    console.error('Files API error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
