'use client';

import { UploadCloudIcon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useUploads } from './upload-context';

export function DropOverlay() {
  const { upload } = useUploads();
  const [visible, setVisible] = useState(false);
  const latestUpload = useRef(upload);

  useEffect(() => {
    latestUpload.current = upload;
  }, [upload]);

  useEffect(() => {
    let depth = 0;
    let internal = false;

    function external(event: DragEvent) {
      return (
        !internal &&
        event.dataTransfer !== null &&
        event.dataTransfer.types.includes('Files')
      );
    }

    function reset() {
      depth = 0;
      setVisible(false);
    }

    function start() {
      internal = true;
    }

    function end() {
      internal = false;
      reset();
    }

    function enter(event: DragEvent) {
      if (!external(event)) {
        return;
      }

      event.preventDefault();
      depth += 1;
      setVisible(true);
    }

    function over(event: DragEvent) {
      if (external(event) && event.dataTransfer !== null) {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'copy';
      }
    }

    function leave(event: DragEvent) {
      if (!external(event)) {
        return;
      }

      depth = Math.max(0, depth - 1);

      if (depth === 0) {
        setVisible(false);
      }
    }

    function drop(event: DragEvent) {
      if (!external(event) || event.dataTransfer === null) {
        internal = false;
        reset();
        return;
      }

      event.preventDefault();
      reset();

      const files = Array.from(event.dataTransfer.files);

      if (files.length > 0) {
        latestUpload.current(files);
      }
    }

    window.addEventListener('dragstart', start);
    window.addEventListener('dragend', end);
    window.addEventListener('dragenter', enter);
    window.addEventListener('dragover', over);
    window.addEventListener('dragleave', leave);
    window.addEventListener('drop', drop);

    return () => {
      window.removeEventListener('dragstart', start);
      window.removeEventListener('dragend', end);
      window.removeEventListener('dragenter', enter);
      window.removeEventListener('dragover', over);
      window.removeEventListener('dragleave', leave);
      window.removeEventListener('drop', drop);
    };
  }, []);

  if (!visible) {
    return null;
  }

  return (
    <div className="bg-background/80 animate-in fade-in pointer-events-none fixed inset-0 z-50 flex items-center justify-center p-6 backdrop-blur-sm duration-150">
      <div className="border-primary/60 bg-primary/5 flex size-full max-w-3xl flex-col items-center justify-center gap-4 rounded-3xl border-2 border-dashed text-center">
        <span className="bg-gradient-brand flex size-16 items-center justify-center rounded-2xl text-white shadow-lg">
          <UploadCloudIcon className="size-8" />
        </span>
        <div>
          <p className="text-lg font-semibold">Drop to upload</p>
          <p className="text-muted-foreground text-sm">
            Files are encrypted before they are stored.
          </p>
        </div>
      </div>
    </div>
  );
}
