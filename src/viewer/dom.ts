interface ElementOptions {
  className?: string;
  text?: string;
  attributes?: Record<string, string>;
}

/** Small typed wrapper so view code reads as structure rather than DOM plumbing. */
export function createElement<Tag extends keyof HTMLElementTagNameMap>(
  tag: Tag,
  options: ElementOptions = {},
  children: Node[] = [],
): HTMLElementTagNameMap[Tag] {
  const element = document.createElement(tag);
  if (options.className) {
    element.className = options.className;
  }
  if (options.text !== undefined) {
    element.textContent = options.text;
  }
  for (const [name, value] of Object.entries(options.attributes ?? {})) {
    element.setAttribute(name, value);
  }
  element.append(...children);
  return element;
}

export function createButton(label: string, onClick: () => void, title?: string): HTMLButtonElement {
  const button = createElement("button", { text: label, attributes: { type: "button", title: title ?? label } });
  button.addEventListener("click", onClick);
  return button;
}

export function createLabeledControl(label: string, control: HTMLElement): HTMLElement {
  return createElement("label", { className: "control" }, [createElement("span", { text: label }), control]);
}

export function createSidebarSection(title: string, children: Node[]): HTMLElement {
  return createElement("section", { className: "detail__section" }, [createElement("h3", { text: title }), ...children]);
}
