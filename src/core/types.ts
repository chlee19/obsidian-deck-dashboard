export interface LayoutItem {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
  /** Layout version 2: the height follows the content (note, markdown and dataview widgets). */
  fit?: boolean;
  /** Layout version 2: shown as its title bar only. */
  collapsed?: boolean;
}

export interface WidgetInstance<TSettings = unknown> {
  type: string;
  title?: string;
  settings: TSettings;
}

export interface Dashboard {
  version: number;
  /**
   * Absent = version 1: x and y are ordering hints and h counts 80 px steps.
   * 2 = fluid layout: x and w are columns of 12, y and h are 8 px rows (see core/fluidLayout).
   */
  layoutVersion?: 2;
  title: string;
  layout: LayoutItem[];
  widgets: Record<string, WidgetInstance>;
}
