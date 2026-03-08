import {
  isExcalidrawFilePath,
  isMermaidFilePath,
  isPlantUmlFilePath,
} from '../../../domain/file-kind.js';
import { getRequestErrorStatusCode } from './http-errors.js';
import { jsonResponse } from './http-response.js';
import { parseJsonBody } from './request-body.js';

export function createVaultApiHandler({
  backlinkIndex,
  plantUmlRenderer = null,
  roomRegistry = null,
  vaultFileStore,
}) {
  return async function handleVaultApi(req, res, requestUrl) {
    if (!requestUrl.pathname.startsWith('/api/')) {
      return false;
    }

    if (requestUrl.pathname === '/api/files' && req.method === 'GET') {
      try {
        const tree = await vaultFileStore.tree();
        jsonResponse(req, res, 200, { tree });
      } catch (error) {
        console.error('[api] Failed to read file tree:', error.message);
        jsonResponse(req, res, 500, { error: 'Failed to read file tree' });
      }
      return true;
    }

    if (requestUrl.pathname === '/api/file' && req.method === 'GET') {
      const filePath = requestUrl.searchParams.get('path');
      if (!filePath) {
        jsonResponse(req, res, 400, { error: 'Missing path parameter' });
        return true;
      }

      try {
        const content = isExcalidrawFilePath(filePath)
          ? await vaultFileStore.readExcalidrawFile(filePath)
          : isMermaidFilePath(filePath)
            ? await vaultFileStore.readMermaidFile(filePath)
            : isPlantUmlFilePath(filePath)
              ? await vaultFileStore.readPlantUmlFile(filePath)
              : await vaultFileStore.readMarkdownFile(filePath);

        if (content === null) {
          jsonResponse(req, res, 404, { error: 'File not found' });
          return true;
        }

        jsonResponse(req, res, 200, { path: filePath, content });
      } catch (error) {
        console.error('[api] Failed to read file:', error.message);
        jsonResponse(req, res, 500, { error: 'Failed to read file' });
      }
      return true;
    }

    if (requestUrl.pathname === '/api/file' && req.method === 'PUT') {
      try {
        const body = await parseJsonBody(req);
        if (!body.path || typeof body.content !== 'string') {
          jsonResponse(req, res, 400, { error: 'Missing path or content' });
          return true;
        }

        const result = isExcalidrawFilePath(body.path)
          ? await vaultFileStore.writeExcalidrawFile(body.path, body.content)
          : isMermaidFilePath(body.path)
            ? await vaultFileStore.writeMermaidFile(body.path, body.content)
            : isPlantUmlFilePath(body.path)
              ? await vaultFileStore.writePlantUmlFile(body.path, body.content)
              : await vaultFileStore.writeMarkdownFile(body.path, body.content);

        if (!result.ok) {
          jsonResponse(req, res, 400, { error: result.error });
          return true;
        }

        jsonResponse(req, res, 200, { ok: true });
      } catch (error) {
        const statusCode = getRequestErrorStatusCode(error);
        if (statusCode) {
          jsonResponse(req, res, statusCode, { error: error.message });
          return true;
        }

        console.error('[api] Failed to write file:', error.message);
        jsonResponse(req, res, 500, { error: 'Failed to write file' });
      }
      return true;
    }

    if (requestUrl.pathname === '/api/plantuml/render' && req.method === 'POST') {
      try {
        const body = await parseJsonBody(req);
        if (typeof body.source !== 'string') {
          jsonResponse(req, res, 400, { error: 'Missing PlantUML source' });
          return true;
        }

        if (!plantUmlRenderer) {
          jsonResponse(req, res, 503, { error: 'PlantUML renderer is not configured' });
          return true;
        }

        const svg = await plantUmlRenderer.renderSvg(body.source);
        jsonResponse(req, res, 200, { ok: true, svg });
      } catch (error) {
        const handledStatusCode = getRequestErrorStatusCode(error);
        if (handledStatusCode) {
          jsonResponse(req, res, handledStatusCode, { error: error.message });
          return true;
        }

        const statusCode = Number.isInteger(error?.statusCode) ? error.statusCode : 502;
        console.error('[api] Failed to render PlantUML:', error.message);
        jsonResponse(req, res, statusCode, {
          error: error instanceof Error ? error.message : 'Failed to render PlantUML',
        });
      }
      return true;
    }

    if (requestUrl.pathname === '/api/file' && req.method === 'POST') {
      try {
        const body = await parseJsonBody(req);
        if (!body.path) {
          jsonResponse(req, res, 400, { error: 'Missing path' });
          return true;
        }

        const result = await vaultFileStore.createFile(body.path, body.content || '');
        if (!result.ok) {
          jsonResponse(req, res, 409, { error: result.error });
          return true;
        }

        backlinkIndex?.onFileCreated(body.path, body.content || '');
        jsonResponse(req, res, 201, { ok: true, path: body.path });
      } catch (error) {
        const statusCode = getRequestErrorStatusCode(error);
        if (statusCode) {
          jsonResponse(req, res, statusCode, { error: error.message });
          return true;
        }

        console.error('[api] Failed to create file:', error.message);
        jsonResponse(req, res, 500, { error: 'Failed to create file' });
      }
      return true;
    }

    if (requestUrl.pathname === '/api/file' && req.method === 'DELETE') {
      const filePath = requestUrl.searchParams.get('path');
      if (!filePath) {
        jsonResponse(req, res, 400, { error: 'Missing path parameter' });
        return true;
      }

      const activeRoom = roomRegistry?.get(filePath);
      try {
        activeRoom?.markDeleted?.();
        const result = await vaultFileStore.deleteFile(filePath);
        if (!result.ok) {
          activeRoom?.unmarkDeleted?.();
          jsonResponse(req, res, 400, { error: result.error });
          return true;
        }

        backlinkIndex?.onFileDeleted(filePath);
        jsonResponse(req, res, 200, { ok: true });
      } catch (error) {
        activeRoom?.unmarkDeleted?.();
        console.error('[api] Failed to delete file:', error.message);
        jsonResponse(req, res, 500, { error: 'Failed to delete file' });
      }
      return true;
    }

    if (requestUrl.pathname === '/api/file' && req.method === 'PATCH') {
      try {
        const body = await parseJsonBody(req);
        if (!body.oldPath || !body.newPath) {
          jsonResponse(req, res, 400, { error: 'Missing oldPath or newPath' });
          return true;
        }

        const result = await vaultFileStore.renameFile(body.oldPath, body.newPath);
        if (!result.ok) {
          jsonResponse(req, res, 400, { error: result.error });
          return true;
        }

        roomRegistry?.rename(body.oldPath, body.newPath);
        backlinkIndex?.onFileRenamed(body.oldPath, body.newPath);
        jsonResponse(req, res, 200, { ok: true, path: body.newPath });
      } catch (error) {
        const statusCode = getRequestErrorStatusCode(error);
        if (statusCode) {
          jsonResponse(req, res, statusCode, { error: error.message });
          return true;
        }

        console.error('[api] Failed to rename file:', error.message);
        jsonResponse(req, res, 500, { error: 'Failed to rename file' });
      }
      return true;
    }

    if (requestUrl.pathname === '/api/directory' && req.method === 'POST') {
      try {
        const body = await parseJsonBody(req);
        if (!body.path) {
          jsonResponse(req, res, 400, { error: 'Missing path' });
          return true;
        }

        const result = await vaultFileStore.createDirectory(body.path);
        if (!result.ok) {
          jsonResponse(req, res, 400, { error: result.error });
          return true;
        }

        jsonResponse(req, res, 201, { ok: true });
      } catch (error) {
        const statusCode = getRequestErrorStatusCode(error);
        if (statusCode) {
          jsonResponse(req, res, statusCode, { error: error.message });
          return true;
        }

        console.error('[api] Failed to create directory:', error.message);
        jsonResponse(req, res, 500, { error: 'Failed to create directory' });
      }
      return true;
    }

    if (requestUrl.pathname === '/api/backlinks' && req.method === 'GET') {
      const filePath = requestUrl.searchParams.get('file');
      if (!filePath) {
        jsonResponse(req, res, 400, { error: 'Missing file parameter' });
        return true;
      }

      try {
        const backlinks = backlinkIndex
          ? await backlinkIndex.getBacklinks(filePath)
          : [];
        jsonResponse(req, res, 200, { file: filePath, backlinks });
      } catch (error) {
        console.error('[api] Failed to get backlinks:', error.message);
        jsonResponse(req, res, 500, { error: 'Failed to get backlinks' });
      }
      return true;
    }

    return false;
  };
}
