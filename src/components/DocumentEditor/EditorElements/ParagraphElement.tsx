import { useContext, useEffect, useState, useRef } from "react";
import { EditorContext } from "@/contexts/EditorContext";
import { ReactEditor, useFocused, useSelected } from "slate-react";
import { Editor, Path, Node, Transforms, Range } from "slate";
import styled from "styled-components";
import { hasSlideElement } from "@/utils/helpers";

const ParagraphStyle = styled.div`
  p[data-placeholder]::after {
    content: attr(data-placeholder);
    pointer-events: none;
    opacity: 0.333;
    user-select: none;
    position: absolute;
    top: 0;
  }
`;

export function ParagraphElement(props) {
  const {
    editor,
    showEditBlockPopup,
    selectedElementID,
    setSelectedElementID,
  } = useContext(EditorContext);
  const { attributes, children, element } = props;
  const path = ReactEditor.findPath(editor, element);
  const [isVisible, setIsVisible] = useState(false);
  const focused = useFocused();
  const selected = useSelected();
  const paragraphRef = useRef(null);

  useEffect(() => {
    if (editor && path) {
      const isFirstElement = Path.equals(path, [0]);
      const hasSingleElement = editor.children.length === 1;
      const isEmpty =
        element.children.length === 1 && element.children[0].text === "";

      setIsVisible(isFirstElement && hasSingleElement && isEmpty);
    }
  }, [editor, path, children, focused]);

  const hasSlide = hasSlideElement(editor.children);
  const [clickCount, setClickCount] = useState(0);

  useEffect(() => {
    if (clickCount === 3) {
      // User has triple-clicked
      // Select the entire text of this node
      Transforms.select(editor, ReactEditor.findPath(editor, element));

      // Reset click count
      setClickCount(0);
    } else if (clickCount > 0) {
      // User has clicked one or two times
      // Wait for 250ms to see if they click again
      const timeoutId = setTimeout(() => setClickCount(0), 250);
      return () => clearTimeout(timeoutId);
    }
  }, [clickCount]);

  useEffect(() => {
    if (!focused && !selected) {
      setSelectedElementID("");
    }
  }, [focused, selected]);

  const shouldShowPlaceholder =
    (isVisible && (!focused || (focused && editor.children.length === 1))) ||
    (focused &&
      selected &&
      element.children[0].text === "" &&
      editor.selection &&
      Range.isCollapsed(editor.selection));

  return (
    <ParagraphStyle>
      <p
        ref={paragraphRef}
        className={`paragraph-element  ${
          selectedElementID === element.id ? " bg-[#E0EDFB]" : ""
        }
        `}
        {...attributes}
        data-id={element.id}
        data-path={JSON.stringify(path)}
        data-placeholder={shouldShowPlaceholder ? "Press '/' for commands" : ""}
        onMouseDown={() => setClickCount((count) => count + 1)}
      >
        {children}
      </p>
    </ParagraphStyle>
  );
}
