export const FILE_VIEWS = ['grid', 'list'] as const;

export type FileView = (typeof FILE_VIEWS)[number];

export const FILE_VIEW_KEY = 'triton:view';

export const APPLY_FILE_VIEW = `try{if(localStorage.getItem('${FILE_VIEW_KEY}')==='list'){document.documentElement.dataset.fileView='list'}}catch(e){}`;

export function markFileView(view: FileView) {
  document.documentElement.dataset.fileView = view;
}
