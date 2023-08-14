import React, {
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTheme } from "styled-components";
import { TextSpeech } from "../TextSpeech";
import { useLocalStorage } from "usehooks-ts";
import AudioPlayer from "../AudioPlayer";
import { useTextSpeech } from "@/contexts/TextSpeechContext";
import { EditorContext } from "@/contexts/EditorContext";
import * as marked from "marked";
import { alignMap } from "../DocumentEditor/helpers/toggleBlock";

import {
  Element as SlateElement,
  Descendant,
  Editor,
  Node,
  Path,
  Text,
  Transforms,
  Range,
} from "slate";
import LoadingSpinner from "@/icons/LoadingSpinner";
import { extractTextValues } from "../DocumentEditor/helpers/extractText";
import { root } from "postcss";
import { Check, ChevronUp, Info, ListEnd, Send } from "lucide-react";
import { api } from "@/utils/api";
import { useRouter } from "next/router";
import { ChevronDown, Link, Copy } from "lucide-react";
import { Input } from "@/components/ui/input";
import { AudioManagerProvider } from "@/contexts/PreviewAudioContext";
import { Button } from "@/components/ui/button";
import { debounce } from "lodash";
import { saveAs } from "file-saver";

import { PreviewContent } from "../PreviewContent";
import { PublishButton } from "../PublishButton";
import { useClipboard } from "@/hooks/useClipboard";
import { MapSettings } from "../MapSettings";
import { deserialize } from "@/hoc/withPasting";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { Portal } from "react-portal";
import { Label } from "../ui/label";
import { ReactEditor } from "slate-react";

import { getHtmlFromSelection } from "@/utils/htmlSerialiser";
import { cn } from "@/utils/cn";
import { UserContext } from "@/contexts/UserContext";
import { AIAssist } from "../AIAssist";
interface RightSideBarProps {
  setRightSideBarWidth: any;
  showRightSidebar: boolean;
  rightSideBarWidth: number;
}

interface AudioNode {
  audio_url?: string;
}

export const RightSideBar: React.FC<RightSideBarProps> = ({
  setRightSideBarWidth,
  showRightSidebar,
  rightSideBarWidth,
}) => {
  const theme = useTheme();
  const router = useRouter();
  const workspaceId = router.query.workspaceId as string;

  const { editor, activePath } = useContext(EditorContext);
  const rootNode = useMemo(() => {
    let path = activePath ? JSON.parse(activePath) : [];
    while (path && path.length > 1) {
      path = Path.parent(path);
    }
    return path.length ? Node.get(editor, path) : null;
  }, [editor, activePath]);

  console.log(rootNode);

  const {
    audioData,
    setAudioData,
    elementData,
    rightBarAudioIsLoading,
    workspaceData,
    refetchWorkspaceData,
    tab,
    setTab,
  } = useTextSpeech();
  const [viewport, setViewPort] = useState({
    width: 390,
    height: 844,
  });

  const [published, setPublished] = useState(workspaceData.workspace.published);
  const [openChat, setOpenChat] = useLocalStorage("openChat", false);
  const { copied, copyToClipboard: copyLink } = useClipboard();

  const [audioURL, setAudioURL] = useState<string>("");
  const [openDropdown, setOpenDropdown] = useState(false);
  const rightSidebarStyle: React.CSSProperties = {
    transform: `translateX(${
      showRightSidebar ? "0px" : `${rightSideBarWidth * 0.8}px`
    })`,
    height: `calc(100vh - ${openChat ? "415" : "157"}px)`,
    minWidth: "390px",
    maxWidth: "570px",
    flexBasis: `${rightSideBarWidth}px`,
    opacity: showRightSidebar ? "1" : "0",
    flexGrow: 0,
    flexShrink: 0,
    pointerEvents: showRightSidebar ? "auto" : "none",
    transition:
      "width 0.3s ease-in-out, opacity 0.4s ease-in-out, transform 0.3s ease-in-out",
  };
  useEffect(() => {
    setPublished(workspaceData.workspace.published);
  }, [workspaceData, router.isReady]);

  useEffect(() => {
    if (audioData) {
      setAudioURL(audioData.audio_url);
    }
  }, [audioData]);

  const handleTabChange = (newTab) => {
    setTab(newTab); // This will also update value in localStorage
  };

  const containsTtsNode = (nodes) => {
    return nodes.some((node) => {
      // if the node itself is of type "tts"
      if (node.type === "tts" && "url" in node) {
        return true;
      }

      // if the node has children, recursively check them
      if ("children" in node) {
        return containsTtsNode(node.children);
      }

      // if neither the node nor its children are of type "tts"
      return false;
    });
  };

  const concatAudio = async () => {
    console.log(editor.children);
    // Assuming editor.children is an array of objects
    let audioUrls: any[] = [];
    editor.children.forEach((child: Descendant) => {
      if ("children" in child && "audio_url" in child) {
        audioUrls.push(child.audio_url);
      }
    });

    // Assuming audioUrls is an array of URLs for audio files
    const blobs = await Promise.all(
      audioUrls.map(async (audioUrl) => {
        const response = await fetch(audioUrl);
        const blob = await response.blob();
        return blob;
      })
    );

    // Concatenate the blobs
    const concatenatedBlob = new Blob(blobs, { type: "audio/mpeg" }); // adjust the MIME type as needed

    // Save concatenated blob
    saveAs(concatenatedBlob, "concatenatedAudio.mp3");
  };

  const [pubLoading, setPubLoading] = useState(false);
  const publishWorkspaceMutation = api.workspace.publishWorkspace.useMutation();

  const publishWorkspace = async () => {
    setPubLoading(true);

    try {
      const response = await publishWorkspaceMutation.mutateAsync({
        id: workspaceId,
      });
      if (response) {
        setPubLoading(false);
        setPublished(response.published);
        refetchWorkspaceData();
        setOpenDropdown(true);
      }
    } catch (error) {
      setPubLoading(false);
      console.error("Error publishing:", error);
    }
  };

  return (
    <AudioManagerProvider>
      <PublishButton
        published={published}
        pubLoading={pubLoading}
        publishWorkspace={publishWorkspace}
        editor={editor}
        openDropdown={openDropdown}
        setOpenDropdown={setOpenDropdown}
      />
      <div
        className="m-w-full  flex hidden grow flex-col rounded-md  border border-gray-300 bg-white  dark:border-accent dark:bg-muted dark:text-lightgray lg:block"
        style={rightSidebarStyle}
      >
        <div className="scrollbar  h-full flex-grow  overflow-y-auto  ">
          <Tabs
            value={tab}
            onValueChange={handleTabChange}
            className=" z-10 flex flex-grow flex-col   "
          >
            <TabsList
              className={cn(
                `ring-gray ring-red sticky top-0 z-10  grid h-10 w-full grid-cols-2  rounded-none rounded-t-md  bg-gray-200 dark:bg-accent`
              )}
            >
              <TabsTrigger
                value="properties"
                className={` data-[state=active]:bg-brand  data-[state=active]:text-white dark:text-muted-foreground dark:data-[state=active]:bg-foreground dark:data-[state=active]:text-background `}
              >
                Properties
              </TabsTrigger>

              <TabsTrigger
                value="preview"
                className={` data-[state=active]:bg-brand  data-[state=active]:text-white dark:text-muted-foreground dark:data-[state=active]:bg-foreground dark:data-[state=active]:text-background `}
              >
                Preview
              </TabsTrigger>
            </TabsList>

            <TabsContent value="properties" className="flex-grow p-3">
              {SlateElement.isElement(rootNode) &&
                rootNode?.type == "map" &&
                elementData && (
                  <MapSettings
                    element={elementData}
                    path={JSON.parse(activePath)}
                  />
                )}
              {SlateElement.isElement(rootNode) &&
                rootNode?.type == "tts" &&
                (audioData && audioData.file_name ? (
                  <>
                    <h3 className="text-bold mb-2 mt-4 text-sm   ">
                      Text to MP3
                    </h3>

                    <div className="my-2 block">
                      <AudioPlayer
                        audioURL={audioData.audio_url}
                        content={rootNode.content}
                        fileName={audioData.file_name}
                      />
                    </div>

                    <div className=" truncate  rounded-md border border-gray-300 p-2 pl-3 dark:border-accent">
                      {audioData.content}{" "}
                    </div>
                    {/* {audioData.transcript && (
                      <div className=" truncate  rounded-md border border-gray-300 p-2 pl-3 dark:border-accent">
                        {audioData.transcript?.transcript}{" "}
                      </div>
                    )} */}

                    <h3 className="text-bold mb-2 mt-4 text-sm">Share Audio</h3>
                    <div className="relative flex items-center">
                      <Link className="absolute left-3 w-4 dark:stroke-gray-300 " />

                      <input
                        value={audioData.audio_url}
                        className=" h-[36px]  w-full rounded-md  rounded-r-none border  border-r-0 border-gray-300 bg-muted  p-2  pl-[40px] text-sm focus:outline-none  focus-visible:outline-none dark:border-accent dark:border-gray-400 dark:text-gray-400"
                        readOnly={true}
                      />
                      <Button
                        variant="outline"
                        className=" h-[36px] rounded-l-none border border-gray-300 bg-background px-2 text-center dark:border-gray-400"
                        onClick={() => copyLink(audioData.audio_url)}
                      >
                        <p className="flex truncate text-xs ">
                          {copied ? "Copied!" : "Copy Link"}
                        </p>
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="relative block rounded-lg border border-gray-300 bg-white p-4 dark:border-accent dark:bg-secondary">
                    No Audio generated
                  </div>
                ))}
            </TabsContent>
            <TabsContent value="preview">
              {/* <div className="flex justify-end gap-3">
                {containsTtsNode(editor.children) && (
                  <button
                    className="mb-2 flex h-[28px] items-center justify-center rounded-md border border-muted-foreground bg-background p-1 text-xs  text-muted-foreground hover:border-accent hover:bg-white hover:text-gray-700 dark:border-muted-foreground dark:bg-secondary dark:text-foreground dark:hover:bg-muted"
                    onClick={concatAudio}
                  >
                    Export as Single Audio File
                  </button>
                )}
              </div> */}
              <PreviewContent />
            </TabsContent>
          </Tabs>
        </div>

        <AIAssist openChat={openChat} setOpenChat={setOpenChat} />
      </div>
    </AudioManagerProvider>
  );
};
