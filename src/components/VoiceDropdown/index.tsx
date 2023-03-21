import React, {
  useState,
  useEffect,
  memo,
  useRef,
  useMemo,
  useCallback,
  useLayoutEffect,
} from "react";
import SampleAudioVoice from "../SampleAudioVoice";
import { VoiceDropdownStyle } from "./style";
import FilterDropdown from "../FilterDropdown";
import Dropdown, { DropdownProvider } from "../Dropdown";
// import ChevronDown from "../../icons/ChevronDown";
import { ChevronDown, Filter } from "lucide-react";
import useClickOutside from "../../hooks/useClickOutside";
import { flags } from "@/icons/flags";
import { api } from "@/utils/api";
import Image from "next/image";
import { mq, breakpoints } from "@/utils/breakpoints";
import { motion, AnimatePresence } from "framer-motion";

import MobileFilterDropdown from "../MobileFilterDropdown";

import {
  fetchVoices,
  getAccents,
  getAges,
  getVoiceStyles,
  getTempos,
} from "../../api/getVoicesApi";
import { Voice } from "../../types/voice";

interface FilterOption {
  key: string;
  value: string;
}

interface Filter {
  key: string;
  value: string;
}

interface VoiceDropdownProps {
  setSelectedVoiceId: (voice: string) => void;
}

const mobile_filter_animation_props = {
  animate: {
    opacity: 1,
    height: 270,
  },
  initial: {
    opacity: 0,
    height: 0,
  },
  transition: {
    duration: 0.2,
  },
  enter: {
    opacity: 1,
    display: "block",
    height: 270,
    transition: {
      duration: 0.4,
    },
    transitionEnd: {
      display: "none",
    },
  },
  exit: {
    opacity: 0,
    height: 0,
    transition: {
      duration: 0.3,
    },
    transitionEnd: {
      display: "none",
    },
  },
};

function VoiceDropdown({ setSelectedVoiceId }: VoiceDropdownProps) {
  const voicesDropdownRef = useRef(null);
  const [voiceDropdownIsOpen, setIsOpen] = useState(false);

  const genderFilterRef = useRef<any>({});
  const accentFilterRef = useRef<any>({});
  const ageFilterRef = useRef<any>({});
  const voiceStylesFilterRef = useRef<any>({});
  const tempoFilterRef = useRef<any>({});

  const [selectedItemText, setSelectedItemText] =
    useState<string>("Choose a voice");

  const [voices, setVoices] = useState<Voice[]>([]);
  const [accents, setAccents] = useState<Filter[]>([]);
  const [ages, setAges] = useState<Filter[]>([]);
  const [voiceStyles, setVoiceStyles] = useState<Filter[]>([]);
  const [tempos, setTempos] = useState<string[]>([]);
  const [filters, setFilters] = useState<Filter[]>([]);

  const [isOpenMobileFilterDropdown, setIsOpenMobileFilterDropdown] =
    useState(false);

  const genders = [
    {
      key: "gender",
      value: "male",
    },
    {
      key: "gender",
      value: "female",
    },
  ];

  const [selectedFilterOption, setSelectedFilterOption] =
    useState<FilterOption>({ key: "", value: "" });

  const [playingStates, setPlayingStates] = useState<boolean[]>(
    new Array<boolean>(voices.length).fill(false)
  );

  const [sampleAudioElement, setSampleAudioElement] =
    useState<HTMLAudioElement | null>(null);

  // const [isFiltering, setIsFiltering] = useState<boolean>(false);

  const MemoizedSampleAudioVoice = memo(SampleAudioVoice);

  const [isOpen, setActiveFilter] = useState<string>("");

  const filteredVoices = useMemo<Voice[]>(() => {
    if (filters.length === 0) {
      return voices;
    }

    let filtered = voices.filter((voice) => {
      return filters.every((filter) => {
        // Element implicitly has an 'any' type because expression of type 'string' can't be used to index type 'Voice'.
        return voice[filter.key] === filter.value.toLowerCase();
      });
    });

    if (
      selectedFilterOption &&
      selectedFilterOption.key !== "" &&
      selectedFilterOption.value !== ""
    ) {
      filtered = filtered.filter((voice) => {
        return (
          voice[selectedFilterOption.key] ===
          selectedFilterOption.value.toLowerCase()
          // Element implicitly has an 'any' type because expression of type 'string' can't be used to index type 'Voice'.
        );
      });
    }

    return filtered;
  }, [voices, filters, selectedFilterOption]);

  const stopButtonRef = useRef<HTMLDivElement>(null);

  const queryResult = api.texttospeech.getVoices.useQuery();
  const desktopbreakpoint = window.screen.width > breakpoints.lg;

  useEffect(() => {
    if (queryResult.data) {
      const fetchedVoices = queryResult.data.voices || [];
      setVoices(fetchedVoices);
      setAccents(getAccents(fetchedVoices));
      setAges(getAges(fetchedVoices));
      setVoiceStyles(getVoiceStyles(fetchedVoices));
      setTempos(getTempos(fetchedVoices));
    }
  }, [queryResult?.data]);

  function handleVoiceSelection(voice: string, name: string): void {
    setSelectedVoiceId(voice);
    setSelectedItemText(name);

    if (voicesDropdownRef.current) {
      voicesDropdownRef.current.handleClose();
    }
  }

  const playAudio = useCallback(
    (index: number): void => {
      if (sampleAudioElement) {
        sampleAudioElement.currentTime = 0;
        sampleAudioElement.pause();

        const prevIndex = playingStates.findIndex((state: boolean) => state);
        if (prevIndex !== -1) {
          setPlayingStates((prevStates: boolean[]) => {
            const newStates = [...prevStates];
            newStates[prevIndex] = false;
            return newStates;
          });
        }
      }
      let newAudioElement = null;
      if (filters.length > 0) {
        newAudioElement = new Audio(filteredVoices[index].sample);
      } else {
        newAudioElement = new Audio(voices[index].sample);
      }

      newAudioElement.play();
      setSampleAudioElement(newAudioElement);

      setPlayingStates((prevStates: boolean[]) => {
        const newStates = [...prevStates];
        newStates[index] = true;
        return newStates;
      });

      newAudioElement.addEventListener("ended", () => {
        setPlayingStates((prevStates: boolean[]) => {
          const newStates = [...prevStates];
          newStates[index] = false;
          return newStates;
        });
      });
    },
    [sampleAudioElement, filters, voices, filteredVoices, playingStates]
  );

  const stopAudio = useCallback(
    (index: number): void => {
      if (sampleAudioElement) {
        sampleAudioElement.currentTime = 0;
        sampleAudioElement.pause();
      }
      setPlayingStates((prevStates: boolean[]) => {
        const newStates = [...prevStates];
        newStates[index] = false;
        return newStates;
      });
    },
    [sampleAudioElement]
  );

  interface FilterOption {
    key: string;
    value: string;
  }

  function onFilterChange(option: FilterOption): void {
    setSelectedFilterOption(option);
    setFilters((prevFilters: FilterOption[]) => {
      const newFilters = [...prevFilters];
      const { key, value } = option;
      const existingFilterIndex = newFilters.findIndex(
        (filter) => filter.key === key
      );
      if (existingFilterIndex !== -1) {
        newFilters[existingFilterIndex].value = value;
      } else {
        newFilters.push({ key, value });
      }
      return newFilters;
    });

    setActiveFilter("");
  }

  const [lastClickedOptions, setLastClickedOptions] = useState<{
    [key: string]: FilterOption;
  }>({});

  function onMobileFilterChange(option: FilterOption): void {
    setFilters((prevFilters: FilterOption[]) => {
      const newFilters = [...prevFilters];
      const { key, value } = option;
      const existingFilterIndex = newFilters.findIndex(
        (filter) => filter.key === key
      );

      if (existingFilterIndex !== -1) {
        if (
          lastClickedOptions[key] &&
          lastClickedOptions[key].value === value
        ) {
          // Remove the filter if the option is already active
          newFilters.splice(existingFilterIndex, 1);
          setLastClickedOptions((prevLastClickedOptions) => {
            const updatedLastClickedOptions = { ...prevLastClickedOptions };
            delete updatedLastClickedOptions[key];
            return updatedLastClickedOptions;
          });
        } else {
          // Update the filter value
          newFilters[existingFilterIndex].value = value;
          setLastClickedOptions((prevLastClickedOptions) => ({
            ...prevLastClickedOptions,
            [key]: option,
          }));
        }
      } else {
        // Add the new filter
        newFilters.push({ key, value });
        setLastClickedOptions((prevLastClickedOptions) => ({
          ...prevLastClickedOptions,
          [key]: option,
        }));
      }

      return newFilters;
    });

    setActiveFilter("");
  }

  const isFiltering = useMemo(
    () => filteredVoices.length === 0 && filters.length > 0,
    [filteredVoices, filters]
  );

  function clearFilters(): void {
    // setIsFiltering(false);
    setFilters([]);
    setSelectedFilterOption({
      key: "",
      value: "",
    });
  }

  function clearIndividualFilter(key: string, value: string): void {
    setFilters((prevFilters: FilterOption[]) => {
      return prevFilters.filter(
        (filter) => filter.key !== key || filter.value !== value
      );
    });

    setSelectedFilterOption((prevSelectedFilterOption: FilterOption) => {
      return prevSelectedFilterOption.key === key &&
        prevSelectedFilterOption.value === value
        ? { key: "", value: "" }
        : prevSelectedFilterOption;
    });
  }

  interface VoiceRowProps {
    voice: Voice;
    index: number;
  }

  const VoiceRow: React.FC<VoiceRowProps> = ({ voice, index }) => {
    const capitalize = (str: string) =>
      str && str.charAt(0).toUpperCase() + str.slice(1);

    return (
      <tr
        key={index}
        onClick={(e) => handleVoiceSelection(voice.voiceId, voice.name)}
        className="voiceItemContainer"
        tabIndex={0}
        role="row"
        aria-label={`Selected Voice: ${voice.name}, ${voice.accent} accent, ${voice.age} age, ${voice.style} style, ${voice.tempo} tempo`}
      >
        <td className="voiceSampleAndName flex items-center text-sm sm:text-base">
          <MemoizedSampleAudioVoice
            isPlaying={playingStates[index]}
            playAudio={(e) => {
              e.stopPropagation();
              playAudio(index);
            }}
            stopAudio={(e) => {
              e.stopPropagation();
              stopAudio(index);
            }}
          />
          {voice.name}
        </td>
        <td>{voice.gender}</td>
        <td>
          <span className="flex items-center text-sm sm:text-base">
            <Image
              src={flags[voice.accent]}
              alt={voice.accent}
              width={28}
              height={28}
              className="flag-icon"
            />

            {desktopbreakpoint && voice.accent}
          </span>
        </td>
        {desktopbreakpoint && (
          <>
            <td className="text-sm sm:text-base">{voice.age}</td>
            <td className="text-sm sm:text-base">{voice.style}</td>
          </>
        )}
      </tr>
    );
  };

  // useEffect(() => {
  //   console.log(voicesDropdownRef.current.isOpen);
  // }, [voicesDropdownRef.current.isOpen]);

  const mobile_filterDropdownOpen = () => {
    setIsOpenMobileFilterDropdown(!isOpenMobileFilterDropdown);
  };

  const closeMobileVoiceDropdown = () => {
    if (voicesDropdownRef.current) {
      voicesDropdownRef.current.handleClose();
    }
    setIsOpenMobileFilterDropdown(false);
  };

  return (
    <VoiceDropdownStyle>
      <DropdownProvider>
        <Dropdown
          dropdownId="voiceDropdown"
          selectedItemText={selectedItemText}
          ref={voicesDropdownRef}
          icon={<ChevronDown className="ml-4 w-4" />}
        >
          <div>
            {desktopbreakpoint && (
              <div>
                {filters.length > 0 && (
                  <div className="filter_label inline-flex justify-center bg-white px-4 py-2 text-sm font-medium text-gray-700 ">
                    <div>
                      <span>Filters:</span>

                      {filters.map((filter) => {
                        const { key, value } = filter;
                        return (
                          <span
                            key={`${key}-${value}`}
                            className="filter_pill mr-2 inline-flex items-center bg-gray-100 text-sm font-medium text-gray-800"
                          >
                            {`${key}: ${value}`}
                            {/* using string interpolation */}
                            <button
                              className="ml-2 focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-opacity-50"
                              onClick={(e) => {
                                e.stopPropagation();
                                clearIndividualFilter(key, value);
                              }}
                              aria-label={`"Clear Filter" ${value} ${key}`}
                            >
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                viewBox="0 0 24 24"
                                strokeWidth="1.5"
                                stroke="currentColor"
                                className="close-icon h-4 w-4 fill-current text-gray-500"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="M6 18L18 6M6 6l12 12"
                                />
                              </svg>
                            </button>
                          </span>
                        );
                      })}
                    </div>

                    <button
                      className="filter_reset inline-flex justify-center rounded-md border-2 border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm outline-none hover:bg-gray-50 focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-opacity-50"
                      onClick={(e) => {
                        e.stopPropagation();
                        clearFilters();
                      }}
                      aria-label="Clear Filters"
                      title="Click to clear all applied filters"
                    >
                      Clear Filters
                    </button>
                  </div>
                )}
              </div>
            )}

            {!desktopbreakpoint && (
              <div className="grid grid-cols-3 border-b border-gray-400">
                <div className="flex justify-start p-3">
                  <button
                    className="flex text-[#007AFF]"
                    onClick={mobile_filterDropdownOpen}
                  >
                    <span className="mr-2">Filters</span>
                    <Filter color="#007AFF" className="w-4" />
                  </button>
                </div>

                <div className="text-bold flex items-center justify-center">
                  Choose a Voice
                </div>
                <div className="flex justify-end p-2">
                  <button
                    className="text-[#007AFF]"
                    onClick={closeMobileVoiceDropdown}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
            {!desktopbreakpoint && (
              <MobileFilterDropdown
                isOpenMobileFilterDropdown={isOpenMobileFilterDropdown}
                filters={filters}
                onMobileFilterChange={onMobileFilterChange}
                clearFilters={clearFilters}
                genders={genders}
                accents={accents}
                ages={ages}
                voiceStyles={voiceStyles}
              />
            )}

            <div className="dropdown_table_wrapper table-responsive">
              <table className="dropdown_table w-full table-auto">
                <thead className="voiceTitles w-full p-4">
                  <tr>
                    {desktopbreakpoint && (
                      <>
                        <th className="nameHeader text-left text-sm sm:text-base">
                          Name
                        </th>
                        <th className="text-left">
                          <FilterDropdown
                            id="gender"
                            options={genders}
                            defaultTitle="Gender"
                            onChange={onFilterChange}
                            ref={genderFilterRef}
                            setActiveFilter={setActiveFilter}
                            isOpen={isOpen === "gender"}
                          />
                        </th>
                        <th className="text-left">
                          <FilterDropdown
                            id="accent"
                            options={accents}
                            defaultTitle="Accent"
                            onChange={onFilterChange}
                            ref={accentFilterRef}
                            setActiveFilter={setActiveFilter}
                            isOpen={isOpen === "accent"}
                          />
                        </th>
                        <th className="text-left">
                          <FilterDropdown
                            id="age"
                            options={ages}
                            defaultTitle="Age"
                            onChange={onFilterChange}
                            ref={ageFilterRef}
                            setActiveFilter={setActiveFilter}
                            isOpen={isOpen === "age"}
                          />
                        </th>
                        <th className="text-left">
                          <FilterDropdown
                            id="style"
                            options={voiceStyles}
                            defaultTitle="Style"
                            onChange={onFilterChange}
                            ref={voiceStylesFilterRef}
                            setActiveFilter={setActiveFilter}
                            isOpen={isOpen === "style"}
                          />
                        </th>{" "}
                      </>
                    )}
                  </tr>
                </thead>

                <tbody className="w-full">
                  {filteredVoices &&
                    filteredVoices.map((voice, index) => (
                      <VoiceRow
                        voice={voice}
                        key={index}
                        index={index}
                        playAudio={playAudio}
                        stopAudio={stopAudio}
                      />
                    ))}

                  {!isFiltering &&
                    filters.length === 0 &&
                    voices.map((voice, index) => (
                      <VoiceRow
                        voice={voice}
                        key={index}
                        index={index}
                        playAudio={playAudio}
                        stopAudio={stopAudio}
                      />
                    ))}
                </tbody>
              </table>

              {isFiltering &&
                !(filters.length > 0 && filteredVoices.length > 0) && (
                  <div className="filter_noResult">
                    No Voices found for selected filters
                  </div>
                )}
            </div>
          </div>
        </Dropdown>
      </DropdownProvider>
    </VoiceDropdownStyle>
  );
}

export default VoiceDropdown;
