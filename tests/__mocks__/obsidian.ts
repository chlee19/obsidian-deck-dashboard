export class Plugin {
  app: any = {};
  manifest: any = {};
  registerView(): void {}
  registerExtensions(): void {}
  addCommand(): void {}
  addRibbonIcon(): any { return null; }
  addStatusBarItem(): any {
    const el: any = {
      addClass: (_: string) => el,
      removeClass: (_: string) => el,
      setText: (_: string) => el,
      setAttribute: (_: string, __: string) => el,
      addEventListener: (_: string, __: any) => el,
      empty: () => el,
    };
    return el;
  }
  addSettingTab(): void {}
  registerEvent(): void {}
  loadData(): Promise<any> { return Promise.resolve({}); }
  saveData(): Promise<void> { return Promise.resolve(); }
  onload(): void {}
  onunload(): void {}
}

export class PluginSettingTab {
  app: any;
  plugin: any;
  containerEl: any = makeFakeEl();
  constructor(app: any, plugin: any) {
    this.app = app;
    this.plugin = plugin;
  }
  display(): void {}
  hide(): void {}
}

export class ItemView {
  containerEl: any = { children: [{}, { empty: () => {}, createEl: () => ({}) }] };
  getViewType(): string { return ""; }
  getDisplayText(): string { return ""; }
  onOpen(): Promise<void> { return Promise.resolve(); }
  onClose(): Promise<void> { return Promise.resolve(); }
}

export class TextFileView extends ItemView {
  data = "";
  file: any = null;
  setViewData(_data: string, _clear: boolean): void {}
  getViewData(): string { return this.data; }
  clear(): void {}
}

export class Modal {
  app: any;
  modalEl: any = { addClass: (_: string) => undefined };
  contentEl: any = makeFakeEl();
  constructor(app: any) {
    this.app = app;
  }
  open(): void {}
  close(): void {}
}

export class Setting {
  constructor(_el: any) {}
  setName(_: string): this { return this; }
  setDesc(_: string): this { return this; }
  addDropdown(cb: (d: any) => void): this {
    const d = {
      addOption: () => d,
      setValue: () => d,
      selectEl: { value: "acceptEdits", disabled: false },
    };
    cb(d);
    return this;
  }
  addText(cb: (t: any) => void): this {
    const t = {
      setValue: () => t,
      onChange: () => t,
      inputEl: { placeholder: "", style: {} },
    };
    cb(t);
    return this;
  }
  addTextArea(cb: (t: any) => void): this {
    const t = {
      setValue: () => t,
      onChange: () => t,
      inputEl: { rows: 0, placeholder: "", style: {} },
    };
    cb(t);
    return this;
  }
  addButton(cb: (b: any) => void): this {
    const b = {
      setButtonText: () => b,
      setCta: () => b,
      setWarning: () => b,
      onClick: () => b,
    };
    cb(b);
    return this;
  }
  addToggle(cb: (tog: any) => void): this {
    const tog = {
      setValue: () => tog,
      onChange: () => tog,
    };
    cb(tog);
    return this;
  }
}

export class WorkspaceLeaf {
  view: any = null;
  openFile(): Promise<void> { return Promise.resolve(); }
  setViewState(): Promise<void> { return Promise.resolve(); }
}

export class TFile {
  path = "";
  basename = "";
  extension = "";
}

export class Notice {
  constructor(_msg: string) {}
}

export const Platform = { isDesktop: true };

export const normalizePath = (p: string) => p;

function makeFakeEl(): any {
  const el: any = {
    addClass: (_: string) => el,
    removeClass: (_: string) => el,
    setText: (_: string) => el,
    setAttribute: (_: string, __: string) => el,
    addEventListener: (_: string, __: any) => el,
    empty: () => el,
    createEl: (_: string, __?: any) => makeFakeEl(),
    createDiv: (_?: any) => makeFakeEl(),
    createSpan: (_?: any) => makeFakeEl(),
    scrollTop: 0,
    scrollHeight: 0,
    rows: 0,
    value: "",
    disabled: false,
  };
  return el;
}

// Minimal moment stand-in: locale() drives i18n, format() is unused in tests
// that rely on injected formatters.
export const moment: any = Object.assign(() => ({ format: () => "" }), {
  locale: () => "en",
});

// Behaves like Obsidian's Component for lifecycle tests: children load with
// their parent, and unloading runs registered cleanups and unloads children.
export class Component {
  private _loaded = false;
  private _children: Component[] = [];
  private _cleanups: (() => void)[] = [];
  load(): void {
    if (this._loaded) return;
    this._loaded = true;
    this.onload();
    for (const c of this._children) c.load();
  }
  unload(): void {
    if (!this._loaded) return;
    this._loaded = false;
    for (const c of [...this._children]) c.unload();
    this._children = [];
    const cleanups = this._cleanups;
    this._cleanups = [];
    for (const fn of cleanups) fn();
    this.onunload();
  }
  onload(): void {}
  onunload(): void {}
  addChild<T extends Component>(c: T): T {
    this._children.push(c);
    if (this._loaded) c.load();
    return c;
  }
  removeChild<T extends Component>(c: T): T {
    this._children = this._children.filter((x) => x !== c);
    c.unload();
    return c;
  }
  register(cb: () => void): void {
    this._cleanups.push(cb);
  }
  registerDomEvent(el: any, type: string, cb: any, opts?: any): void {
    el.addEventListener(type, cb, opts);
    this.register(() => el.removeEventListener(type, cb, opts));
  }
}
