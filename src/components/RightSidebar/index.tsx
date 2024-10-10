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
import { EditorContext, SlateEditorContext } from "@/contexts/EditorContext";
import * as marked from "marked";
import { alignMap } from "../DocumentEditor/helpers/toggleBlock";
import { ReactGrid, TextCell, CellChange } from "@silevis/reactgrid";

import { SyncStatusIndicator } from "@/components/SaveStatus";
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
import { Check, ChevronUp, Crown, Info, ListEnd, Send } from "lucide-react";
import { api } from "@/utils/api";
import { useRouter } from "next/router";
import { ChevronDown, Link, Copy } from "lucide-react";
import { Input } from "@/components/ui/input";
import { AudioManagerProvider } from "@/contexts/PreviewAudioContext";
import { Button } from "@/components/ui/button";
import { debounce } from "lodash";
import { saveAs } from "file-saver";

import { DocsPreview } from "../PreviewContent/docs";
import { SlidesPreview } from "../PreviewContent/slides";
import { PublishButton } from "../PublishButton";
import { useClipboard } from "@/hooks/useClipboard";
import { MapSettings } from "../MapSettings";
import { ImageSettings } from "../ImageSettings";
import { deserialize } from "@/hoc/withPasting";

import { Portal } from "react-portal";
import { Label } from "../ui/label";
import { ReactEditor } from "slate-react";

import { getHtmlFromSelection } from "@/utils/htmlSerialiser";
import { cn } from "@/utils/cn";
import { UserContext } from "@/contexts/UserContext";
import { AIAssist } from "../AIAssist";
import { FontStyle } from "../FontStyle";
import { Export } from "../Export";
import { LayoutContext } from "../Layouts/AccountLayout";
import { DownloadButton } from "../DownloadButton";
import { PlyrAudioPlayer } from "../PlyrAudio";
import { WorkspaceSetting, SetTheme } from "../WorkspaceSetting";
import { EmbedVideoSettings } from "../EmbedVideoSettings";
import { DataVisSettings } from "../DataVisSettings";
import { splitIntoSlides } from "@/utils/renderHelpers";
import { Dialog, DialogContent, DialogTrigger } from "../ui/dialog";
import Upgrade from "../Upgrade";
interface RightSideBarProps {
  showRightSidebar: boolean;
  rightSideBarWidth: number;
}

interface AudioNode {
  audio_url?: string;
}

export const RightSideBar: React.FC<RightSideBarProps> = ({
  showRightSidebar,
  rightSideBarWidth,
}) => {
  const theme = useTheme();
  const router = useRouter();
  const { setIsOpen, setIsLocked } = useContext(LayoutContext);

  const { activePath } = useContext(EditorContext);
  const { editor } = useContext(SlateEditorContext);
  const rootNode = useMemo(() => {
    let path = activePath ? JSON.parse(activePath) : [];
    while (path && path.length > 1) {
      path = Path.parent(path);
    }
    return path.length ? Node.get(editor, path) : null;
  }, [editor, activePath]);

  const { audioData, elementData, rightBarAudioIsLoading, tab, setTab } =
    useTextSpeech();
  const [viewport, setViewPort] = useState({
    width: 390,
    height: 844,
  });

  const slides = splitIntoSlides(editor.children);

  const [openChat, setOpenChat] = useLocalStorage("openChat", false);
  const { copied, copyToClipboard: copyLink } = useClipboard();

  const { upgrade, ...rest } = router.query;
  const [openUpgrade, setOpenUpgrade] = useState(false);

  const onOpenChangeUpgrade = (value) => {
    setOpenUpgrade(value);

    if (value) {
      router.push({
        pathname: router.pathname,
        query: { ...router.query, upgrade: "true" },
      });
    } else {
      router.push(
        {
          pathname: router.pathname,
          query: rest,
        },
        undefined,
        { shallow: true }
      );
    }
  };

  useEffect(() => {
    if (upgrade) {
      setOpenUpgrade(Boolean(upgrade));
    } else {
      // This line will be executed when upgradePop changes to a falsy value

      setOpenUpgrade(false);
    }
  }, [upgrade]);

  const rightSidebarStyle: React.CSSProperties = {
    transform: `translateX(${
      showRightSidebar ? "0px" : `${rightSideBarWidth * 0.8}px`
    })`,
    height: `calc(100svh - 100px)`,
    flexBasis: "300px",
    opacity: showRightSidebar ? "1" : "0",
    maxWidth: "300px",
    flexGrow: 0,
    flexShrink: 0,
    pointerEvents: showRightSidebar ? "auto" : "none",
    transition:
      "width 0.3s ease-in-out, opacity 0.4s ease-in-out, transform 0.3s ease-in-out",
  };

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

  // useEffect(() => {
  //   if (showRightSidebar) {
  //     setTimeout(() => {
  //       setIsOpen(false);
  //       setIsLocked(false);
  //     }, 400);
  //   }
  // }, [showRightSidebar]);

  useEffect(() => {
    if (slides.length === 0) {
      setTab("properties");
    }
  }, [slides.length]);

  const isElementSelected =
    SlateElement.isElement(rootNode) &&
    ((rootNode?.type == "datavis" && elementData) ||
      (rootNode?.type == "image" && elementData) ||
      (rootNode?.type == "embed" && elementData) ||
      (rootNode?.type == "map" && elementData) ||
      (rootNode?.type == "tts" && elementData));

  return (
    <AudioManagerProvider>
      <Portal>
        <div className="fixed right-[80px] top-[25px] flex gap-3">
          <div className="flex items-center">
            <Dialog open={openUpgrade} onOpenChange={onOpenChangeUpgrade}>
              <DialogTrigger asChild>
                <Button
                  variant="outline"
                  size="xs"
                  className=" border border-gray-300"
                  // onClick={upgradeAccount}
                >
                  <span className="mr-2 text-xs text-foreground  dark:text-foreground ">
                    Upgrade
                  </span>
                  <Crown className="w-5 fill-orange-200 text-orange-500 dark:text-orange-300" />{" "}
                </Button>
              </DialogTrigger>

              <DialogContent className="absolute max-h-[650px]  overflow-y-auto p-0 sm:max-w-[950px]">
                <Upgrade />
              </DialogContent>
            </Dialog>
          </div>

          <SyncStatusIndicator />
          <PublishButton />
        </div>
      </Portal>
      <div
        className="m-w-full  flex hidden grow flex-col rounded-md  border border-gray-300 bg-white  dark:border-accent dark:bg-muted dark:text-lightgray lg:block"
        style={rightSidebarStyle}
      >
        <div className="h-full flex-grow overflow-hidden">
          <Tabs value={tab} onValueChange={handleTabChange} className="mb-0">
            <TabsList
              className={cn(
                `ring-gray ring-red  z-10  grid h-10 w-full  grid-cols-2 rounded-none  rounded-t-md bg-gray-200 dark:bg-accent`
              )}
            >
              <TabsTrigger
                value="workspaceSettings"
                className={` text-xs data-[state=active]:bg-brand data-[state=active]:text-white dark:text-gray-400 dark:data-[state=active]:bg-foreground dark:data-[state=active]:text-background `}
              >
                Config
              </TabsTrigger>

              <TabsTrigger
                value="properties"
                className={` text-xs data-[state=active]:bg-brand  data-[state=active]:text-white dark:text-gray-400 dark:data-[state=active]:bg-foreground dark:data-[state=active]:text-background `}
                disabled={!isElementSelected}
              >
                Properties
              </TabsTrigger>
            </TabsList>

            <TabsContent
              value="properties"
              className="scrollbar flex-grow  overflow-y-auto pb-5 "
              style={{
                top: -8,
                height: `calc(100svh - 145px)`,
              }}
            >
              {SlateElement.isElement(rootNode) &&
                rootNode?.type == "datavis" &&
                elementData && <DataVisSettings element={elementData} />}

              {SlateElement.isElement(rootNode) &&
                rootNode?.type == "image" &&
                elementData && <ImageSettings element={elementData} />}

              {SlateElement.isElement(rootNode) &&
                rootNode?.type == "embed" &&
                elementData && <EmbedVideoSettings element={elementData} />}
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
                  <div className=" mt-3 bg-brand/20 p-2 dark:bg-gray-800">
                    <h3 className="mb-2 mt-4 text-sm font-bold   ">
                      Text to MP3
                    </h3>

                    <div className="my-2  flex w-full rounded-md border border-gray-300 bg-white dark:border-accent dark:bg-muted">
                      {/* <AudioPlayer
                        audioURL={audioData.audio_url}
                        content={elementData.content}
                        fileName={audioData.file_name}
                      /> */}
                      <div className="grow">
                        <PlyrAudioPlayer
                          audioURL={audioData.audio_url}
                          content={elementData.content}
                          isPreview={true}
                        />
                      </div>
                      <div className="flex items-center pr-3 ">
                        <DownloadButton
                          url={audioData.audio_url}
                          fileName={audioData.file_name}
                        />
                      </div>
                    </div>

                    <div className=" truncate  rounded-md border border-gray-300 bg-white p-2 pl-3 dark:border-accent dark:bg-muted">
                      {audioData.content}{" "}
                    </div>
                    {/* {audioData.transcript && (
                      <div className=" truncate  rounded-md border border-gray-300 p-2 pl-3 dark:border-accent">
                        {audioData.transcript?.transcript}{" "}
                      </div>
                    )} */}

                    {/* <div className="mt-4 flex justify-end">
                      <DownloadButton
                        url={audioData.audio_url}
                        fileName={audioData.file_name}
                      />
                    </div> */}

                    <h3 className="mb-2 mt-4 text-sm font-bold">Share Audio</h3>
                    <div className="relative flex items-center">
                      <Link className="absolute left-3 w-4 dark:stroke-gray-300 " />

                      <input
                        value={audioData.audio_url}
                        className=" h-[36px]  w-full rounded-md  rounded-r-none border  border-r-0 border-gray-300 bg-muted  p-2  pl-[40px] text-sm focus:outline-none  focus-visible:outline-none dark:border-gray-700 dark:text-gray-400"
                        readOnly={true}
                      />
                      <Button
                        variant="outline"
                        className=" h-[36px]  rounded-l-none border border-gray-300 bg-background px-2 text-center ring-brand focus-visible:ring-2 dark:border-gray-700 dark:ring-white"
                        onClick={() => copyLink(audioData.audio_url)}
                      >
                        <p className="flex truncate text-xs ">
                          {copied ? "Copied!" : "Copy Link"}
                        </p>
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="relative m-3 block rounded-lg border border-gray-300 bg-white  p-4 dark:border-accent dark:bg-secondary">
                    No Audio generated
                  </div>
                ))}
            </TabsContent>

            <TabsContent
              value="workspaceSettings"
              className="scrollbar relative overflow-y-auto pb-5"
              style={{
                top: -8,
                height: `calc(100svh - 145px)`,
              }}
            >
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
              <FontStyle />
              <SetTheme />
            </TabsContent>
          </Tabs>
        </div>

        {/* <AIAssist openChat={openChat} setOpenChat={setOpenChat} /> */}
      </div>
    </AudioManagerProvider>
  );
};
