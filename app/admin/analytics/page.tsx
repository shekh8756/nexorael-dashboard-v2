"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

/* =========================================
   TYPES
========================================= */

type Period =
  | "lastSevenDays"
  | "lastThirtyDays"
  | "lastMonth"
  | "lastThreeMonths"
  | "lastSixMonths"
  | "lastYear"
  | "allTime";

type Summary = {
  totalRevenue: number;
  latestRevenue: number;
  latestRevenueMonth:
    string | null;
  totalStreams: number;
  totalSaves: number;
  totalSkips: number;
  averageEngagement: number;
  totalTracks: number;
  totalChannels: number;
};

type MonthlyRevenue = {
  date: string;
  total: number;
};

type Channel = {
  name: string;
  total: number;
  logo: string | null;
  logoDark:
    | string
    | null;
  logoDefault:
    | string
    | null;
};

type Track = {
  isrc: string;
  track: string;
  release: string;
  totalStreams: number;
  totalSaves: number;
  totalSkips: number;
  engagement: number;
};

type AnalyticsResponse = {
  success: boolean;
  period: Period;
  generatedAt: string;

  summary: Summary;

  monthlyRevenue:
    MonthlyRevenue[];

  channels: Channel[];

  tracks: Track[];

  topTracks: Track[];

  apiErrors: any[];

  error?: string;
};

type AnalyticsPlatform = {
  id:
    | string
    | number;

  value: string;

  name: string;

  logo?: string | null;
};

type PlatformPoint = {
  date: string;
  streams: number;
};

type PlatformTrack = {
  isrc: string;
  streams: number;
  track: string;
  title: string;
  release: string;
  cover:
    | string
    | null;
};

type PlatformSource = {
  platform_name: string;
  streams: number;
};

type PlatformAnalyticsResponse =
  {
    success: boolean;

    platform:
      string;

    period:
      Period;

    release:
      string | null;

    overview:
      any;

    totalStreams:
      {
        data?: {
          totalStreams?: PlatformPoint[];

          tracksTotal?: PlatformTrack[];

          streamsTotal?: number;

          countryTotal?: any[];
        };
      } | null;

    additional?: Record<
      string,
      any
    >;

    apiStatus?: {
      overview?: number;

      totalStreams?: number;
    };

    generatedAt?:
      string;

    error?: string;
  };

/* =========================================
   PERIODS
========================================= */

const periodOptions: {
  value: Period;
  label: string;
}[] = [
  {
    value:
      "lastSevenDays",
    label:
      "Last 7 Days",
  },

  {
    value:
      "lastThirtyDays",
    label:
      "Last 30 Days",
  },

  {
    value:
      "lastMonth",
    label:
      "Last Month",
  },

  {
    value:
      "lastThreeMonths",
    label:
      "Last 3 Months",
  },

  {
    value:
      "lastSixMonths",
    label:
      "Last 6 Months",
  },

  {
    value:
      "lastYear",
    label:
      "Last Year",
  },

  {
    value:
      "allTime",
    label:
      "All Time",
  },
];

/* =========================================
   PAGE
========================================= */

export default function AdminAnalyticsPage() {
  const [
    period,
    setPeriod,
  ] =
    useState<Period>(
      "lastThirtyDays"
    );

  const [
    selectedPlatform,
    setSelectedPlatform,
  ] =
    useState(
      "tiktok"
    );

  const [
    platforms,
    setPlatforms,
  ] =
    useState<
      AnalyticsPlatform[]
    >([]);

  const [
    data,
    setData,
  ] =
    useState<AnalyticsResponse | null>(
      null
    );

  const [
    platformData,
    setPlatformData,
  ] =
    useState<PlatformAnalyticsResponse | null>(
      null
    );

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    platformLoading,
    setPlatformLoading,
  ] =
    useState(true);

  const [
    platformListLoading,
    setPlatformListLoading,
  ] =
    useState(true);

  const [
    error,
    setError,
  ] =
    useState("");

  const [
    platformError,
    setPlatformError,
  ] =
    useState("");

  /* ======================================
     LOAD PLATFORM LIST
  ====================================== */

  const loadPlatforms =
    useCallback(
      async () => {
        try {
          setPlatformListLoading(
            true
          );

          const response =
            await fetch(
              "/api/admin/analytics/platform?action=platforms",
              {
                cache:
                  "no-store",
              }
            );

          const json =
            await response.json();

          if (
            !response.ok ||
            !json.success
          ) {
            console.warn(
              "Platform list:",
              json
            );

            return;
          }

          const list =
            Array.isArray(
              json.platforms
            )
              ? json.platforms
              : [];

          setPlatforms(
            list
          );

          if (
            list.length >
              0 &&
            !list.some(
              (
                item: AnalyticsPlatform
              ) =>
                item.value ===
                selectedPlatform
            )
          ) {
            setSelectedPlatform(
              list[0]
                .value
            );
          }
        } catch (
          error
        ) {
          console.error(
            "Load platforms:",
            error
          );
        } finally {
          setPlatformListLoading(
            false
          );
        }
      },
      [
        selectedPlatform,
      ]
    );

  /* ======================================
     GENERAL ANALYTICS
  ====================================== */

  const loadAnalytics =
    useCallback(
      async () => {
        setLoading(
          true
        );

        setError("");

        try {
          const response =
            await fetch(
              `/api/admin/analytics?period=${period}`,
              {
                cache:
                  "no-store",
              }
            );

          const json =
            (await response.json()) as AnalyticsResponse;

          if (
            !response.ok ||
            !json.success
          ) {
            throw new Error(
              json.error ||
                "Unable to load Too Lost analytics."
            );
          }

          setData(
            json
          );
        } catch (
          error
        ) {
          setError(
            error instanceof
              Error
              ? error.message
              : "Unable to load analytics."
          );
        } finally {
          setLoading(
            false
          );
        }
      },
      [period]
    );

  /* ======================================
     PLATFORM ANALYTICS
  ====================================== */

  const loadPlatformAnalytics =
    useCallback(
      async () => {
        if (
          !selectedPlatform
        ) {
          return;
        }

        setPlatformLoading(
          true
        );

        setPlatformError(
          ""
        );

        try {
          const params =
            new URLSearchParams();

          params.set(
            "platform",
            selectedPlatform
          );

          params.set(
            "period",
            period
          );

          const response =
            await fetch(
              `/api/admin/analytics/platform?${params.toString()}`,
              {
                cache:
                  "no-store",
              }
            );

          const json =
            (await response.json()) as PlatformAnalyticsResponse;

          if (
            !response.ok ||
            !json.success
          ) {
            throw new Error(
              json.error ||
                "Unable to load platform analytics."
            );
          }

          setPlatformData(
            json
          );
        } catch (
          error
        ) {
          setPlatformError(
            error instanceof
              Error
              ? error.message
              : "Unable to load platform analytics."
          );

          setPlatformData(
            null
          );
        } finally {
          setPlatformLoading(
            false
          );
        }
      },
      [
        selectedPlatform,
        period,
      ]
    );

  /* ======================================
     EFFECTS
  ====================================== */

  useEffect(() => {
    loadPlatforms();
  }, [loadPlatforms]);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  useEffect(() => {
    loadPlatformAnalytics();
  }, [
    loadPlatformAnalytics,
  ]);

  /* ======================================
     GENERAL CALCULATIONS
  ====================================== */

  const maxRevenue =
    useMemo(() => {
      if (
        !data
          ?.monthlyRevenue
          ?.length
      ) {
        return 0;
      }

      return Math.max(
        ...data.monthlyRevenue.map(
          (item) =>
            Number(
              item.total ||
                0
            )
        ),
        0
      );
    }, [data]);

  /* ======================================
     PLATFORM CALCULATIONS
  ====================================== */

  const platformPayload =
    platformData
      ?.totalStreams
      ?.data || {};

  const platformTimeline =
    Array.isArray(
      platformPayload.totalStreams
    )
      ? platformPayload.totalStreams
      : [];

  const platformTracks =
    Array.isArray(
      platformPayload.tracksTotal
    )
      ? platformPayload.tracksTotal
      : [];

  const countryTotals =
    Array.isArray(
      platformPayload.countryTotal
    )
      ? platformPayload.countryTotal
      : [];

  const platformTotal =
    Number(
      platformPayload.streamsTotal ||
        0
    );

  const sortedTimeline =
    useMemo(
      () =>
        [
          ...platformTimeline,
        ].sort(
          (
            a,
            b
          ) =>
            new Date(
              a.date
            ).getTime() -
            new Date(
              b.date
            ).getTime()
        ),
      [platformTimeline]
    );

  const maxPlatformValue =
    useMemo(() => {
      if (
        sortedTimeline.length ===
        0
      ) {
        return 0;
      }

      return Math.max(
        ...sortedTimeline.map(
          (item) =>
            Number(
              item.streams ||
                0
            )
        ),
        0
      );
    }, [sortedTimeline]);

  const sources =
    normalizeSourceData(
      platformData
        ?.additional
        ?.sources
    );

  const selectedPlatformName =
    platforms.find(
      (item) =>
        item.value ===
        selectedPlatform
    )?.name ||
    prettyPlatformName(
      selectedPlatform
    );

  /* ======================================
     LOADING
  ====================================== */

  if (
    loading &&
    !data
  ) {
    return (
      <main
        style={
          pageStyle
        }
      >
        Loading Too Lost
        analytics...
      </main>
    );
  }

  /* ======================================
     UI
  ====================================== */

  return (
    <main
      style={
        pageStyle
      }
    >
      {/* HEADER */}

      <div
        style={
          headerStyle
        }
      >
        <div>
          <div
            style={
              badgeStyle
            }
          >
            TOO LOST API
          </div>

          <h1
            style={
              titleStyle
            }
          >
            Analytics &
            Revenue
          </h1>

          <p
            style={
              subtitleStyle
            }
          >
            Revenue,
            distribution
            analytics and
            platform usage
            directly from Too
            Lost.
          </p>
        </div>

        <div
          style={
            headerActions
          }
        >
          <select
            value={
              period
            }
            onChange={(
              event
            ) =>
              setPeriod(
                event
                  .target
                  .value as Period
              )
            }
            style={
              selectStyle
            }
          >
            {periodOptions.map(
              (
                option
              ) => (
                <option
                  key={
                    option.value
                  }
                  value={
                    option.value
                  }
                >
                  {
                    option.label
                  }
                </option>
              )
            )}
          </select>

          <button
            type="button"
            onClick={() => {
              loadAnalytics();
              loadPlatformAnalytics();
              loadPlatforms();
            }}
            style={
              refreshButton
            }
          >
            {loading ||
            platformLoading
              ? "Refreshing..."
              : "↻ Refresh"}
          </button>
        </div>
      </div>

      {error && (
        <div
          style={
            errorBox
          }
        >
          {error}
        </div>
      )}

      {/* =====================================
          GENERAL SUMMARY
      ====================================== */}

      {data && (
        <>
          <div
            style={
              cardsGrid
            }
          >
            <StatCard
              title="Total Reported Revenue"
              value={formatMoney(
                data.summary
                  .totalRevenue
              )}
              sub="Too Lost sales"
            />

            <StatCard
              title="Latest Revenue"
              value={formatMoney(
                data.summary
                  .latestRevenue
              )}
              sub={
                data.summary
                  .latestRevenueMonth
                  ? formatMonth(
                      data.summary
                        .latestRevenueMonth
                    )
                  : "No reporting month"
              }
            />

            <StatCard
              title="Analytics Streams"
              value={formatNumber(
                data.summary
                  .totalStreams
              )}
              sub={periodLabel(
                period
              )}
            />

            <StatCard
              title="DSP Channels"
              value={formatNumber(
                data.summary
                  .totalChannels
              )}
              sub="Revenue channels"
            />

            <StatCard
              title="Tracks"
              value={formatNumber(
                data.summary
                  .totalTracks
              )}
              sub="Analytics tracks"
            />
          </div>

          {/* =================================
              BY PLATFORM
          ================================== */}

          <section
            style={
              platformPanel
            }
          >
            <div
              style={
                platformTopBar
              }
            >
              <div>
                <div
                  style={
                    platformBadge
                  }
                >
                  BY PLATFORM
                </div>

                <h2
                  style={
                    platformTitle
                  }
                >
                  {
                    selectedPlatformName
                  }{" "}
                  Analytics
                </h2>

                <p
                  style={
                    smallMuted
                  }
                >
                  Real Too Lost
                  platform
                  analytics.
                </p>
              </div>

              <div
                style={
                  platformControls
                }
              >
                <select
                  value={
                    selectedPlatform
                  }
                  disabled={
                    platformListLoading
                  }
                  onChange={(
                    event
                  ) =>
                    setSelectedPlatform(
                      event
                        .target
                        .value
                    )
                  }
                  style={
                    platformSelect
                  }
                >
                  {platforms.length ===
                  0 ? (
                    <option
                      value={
                        selectedPlatform
                      }
                    >
                      {
                        selectedPlatformName
                      }
                    </option>
                  ) : (
                    platforms.map(
                      (
                        item
                      ) => (
                        <option
                          key={
                            item.value
                          }
                          value={
                            item.value
                          }
                        >
                          {
                            item.name
                          }
                        </option>
                      )
                    )
                  )}
                </select>

                <span
                  style={
                    liveBadge
                  }
                >
                  ● LIVE API
                </span>
              </div>
            </div>

            {platformError && (
              <div
                style={
                  errorBox
                }
              >
                {
                  platformError
                }
              </div>
            )}

            {platformLoading ? (
              <div
                style={
                  emptyBox
                }
              >
                Loading{" "}
                {
                  selectedPlatformName
                }{" "}
                analytics...
              </div>
            ) : (
              <>
                {/* TOTAL CARDS */}

                <div
                  style={
                    platformCards
                  }
                >
                  <MetricCard
                    label="Total Usage / Streams"
                    value={formatNumber(
                      platformTotal
                    )}
                  />

                  <MetricCard
                    label="Tracks"
                    value={formatNumber(
                      platformTracks.length
                    )}
                  />

                  <MetricCard
                    label="Countries"
                    value={formatNumber(
                      countryTotals.length
                    )}
                  />

                  <MetricCard
                    label="Sources"
                    value={formatNumber(
                      sources.length
                    )}
                  />
                </div>

                {/* TIMELINE */}

                <div
                  style={
                    chartPanel
                  }
                >
                  <div
                    style={
                      sectionHeader
                    }
                  >
                    <div>
                      <h3
                        style={
                          sectionTitle
                        }
                      >
                        Usage Over
                        Time
                      </h3>

                      <div
                        style={
                          smallMuted
                        }
                      >
                        {
                          periodLabel(
                            period
                          )
                        }
                      </div>
                    </div>

                    <strong
                      style={
                        bigTotal
                      }
                    >
                      {formatNumber(
                        platformTotal
                      )}
                    </strong>
                  </div>

                  {sortedTimeline.length ===
                  0 ? (
                    <EmptyState text="No timeline data available." />
                  ) : (
                    <div
                      style={
                        chartArea
                      }
                    >
                      {sortedTimeline.map(
                        (
                          point
                        ) => {
                          const percentage =
                            maxPlatformValue >
                            0
                              ? Math.max(
                                  2,
                                  (Number(
                                    point.streams ||
                                      0
                                  ) /
                                    maxPlatformValue) *
                                    100
                                )
                              : 0;

                          return (
                            <div
                              key={
                                point.date
                              }
                              style={
                                chartColumn
                              }
                              title={`${point.date}: ${formatNumber(
                                point.streams
                              )}`}
                            >
                              <div
                                style={
                                  chartValueLabel
                                }
                              >
                                {point.streams >
                                0
                                  ? formatCompactNumber(
                                      point.streams
                                    )
                                  : ""}
                              </div>

                              <div
                                style={
                                  chartTrack
                                }
                              >
                                <div
                                  style={{
                                    ...chartFill,
                                    height: `${percentage}%`,
                                  }}
                                />
                              </div>

                              <div
                                style={
                                  chartDate
                                }
                              >
                                {formatShortDate(
                                  point.date
                                )}
                              </div>
                            </div>
                          );
                        }
                      )}
                    </div>
                  )}
                </div>

                {/* TRACKS + COUNTRIES */}

                <div
                  style={
                    twoColumnGrid
                  }
                >
                  <div
                    style={
                      innerPanel
                    }
                  >
                    <div
                      style={
                        sectionHeader
                      }
                    >
                      <div>
                        <h3
                          style={
                            sectionTitle
                          }
                        >
                          Tracks
                        </h3>

                        <div
                          style={
                            smallMuted
                          }
                        >
                          Usage by
                          track
                        </div>
                      </div>
                    </div>

                    {platformTracks.length ===
                    0 ? (
                      <EmptyState text="No track data available." />
                    ) : (
                      platformTracks.map(
                        (
                          track,
                          index
                        ) => (
                          <PlatformTrackRow
                            key={`${track.isrc}-${index}`}
                            track={
                              track
                            }
                            total={
                              platformTotal
                            }
                          />
                        )
                      )
                    )}
                  </div>

                  <div
                    style={
                      innerPanel
                    }
                  >
                    <div
                      style={
                        sectionHeader
                      }
                    >
                      <div>
                        <h3
                          style={
                            sectionTitle
                          }
                        >
                          Countries
                        </h3>

                        <div
                          style={
                            smallMuted
                          }
                        >
                          Geographic
                          usage
                        </div>
                      </div>
                    </div>

                    {countryTotals.length ===
                    0 ? (
                      <EmptyState text="No country data available for this endpoint." />
                    ) : (
                      <div
                        style={
                          simpleList
                        }
                      >
                        {countryTotals.map(
                          (
                            country: any,
                            index: number
                          ) => (
                            <SimpleDataRow
                              key={
                                index
                              }
                              name={
                                country?.country ||
                                country?.name ||
                                country?.country_name ||
                                "Unknown"
                              }
                              value={formatNumber(
                                Number(
                                  country?.streams ??
                                    country?.total ??
                                    country?.events ??
                                    0
                                )
                              )}
                            />
                          )
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* SOURCES */}

                <div
                  style={
                    sourcesPanel
                  }
                >
                  <div
                    style={
                      sectionHeader
                    }
                  >
                    <div>
                      <h3
                        style={
                          sectionTitle
                        }
                      >
                        Sources
                      </h3>

                      <div
                        style={
                          smallMuted
                        }
                      >
                        Platform
                        traffic
                        sources
                      </div>
                    </div>
                  </div>

                  {sources.length ===
                  0 ? (
                    <EmptyState text="No source data available." />
                  ) : (
                    <div
                      style={
                        simpleList
                      }
                    >
                      {sources.map(
                        (
                          source,
                          index
                        ) => (
                          <SimpleDataRow
                            key={`${source.platform_name}-${index}`}
                            name={
                              source.platform_name ||
                              "Unknown"
                            }
                            value={formatNumber(
                              source.streams
                            )}
                          />
                        )
                      )}
                    </div>
                  )}
                </div>
              </>
            )}
          </section>

          {/* =================================
              REVENUE BY PLATFORM
          ================================== */}

          <section
            style={
              panelStyle
            }
          >
            <div
              style={
                sectionHeader
              }
            >
              <div>
                <h2
                  style={
                    panelTitle
                  }
                >
                  Revenue by
                  Platform
                </h2>

                <div
                  style={
                    smallMuted
                  }
                >
                  Too Lost sales
                  channels
                </div>
              </div>
            </div>

            {data.channels.length ===
            0 ? (
              <EmptyState text="No revenue channel data available." />
            ) : (
              <div
                style={
                  channelGrid
                }
              >
                {data.channels.map(
                  (
                    channel
                  ) => (
                    <div
                      key={
                        channel.name
                      }
                      style={
                        channelCard
                      }
                    >
                      <div
                        style={
                          channelLogoWrap
                        }
                      >
                        {channel.logoDark ||
                        channel.logo ? (
                          <img
                            src={
                              channel.logoDark ||
                              channel.logo ||
                              ""
                            }
                            alt={
                              channel.name
                            }
                            style={
                              channelLogo
                            }
                          />
                        ) : (
                          "♪"
                        )}
                      </div>

                      <div>
                        <div
                          style={
                            channelName
                          }
                        >
                          {
                            channel.name
                          }
                        </div>

                        <strong>
                          {formatMoney(
                            channel.total
                          )}
                        </strong>
                      </div>
                    </div>
                  )
                )}
              </div>
            )}
          </section>

          {/* =================================
              HISTORICAL REVENUE
          ================================== */}

          <section
            style={
              panelStyle
            }
          >
            <div
              style={
                sectionHeader
              }
            >
              <div>
                <h2
                  style={
                    panelTitle
                  }
                >
                  Historical
                  Revenue
                </h2>

                <div
                  style={
                    smallMuted
                  }
                >
                  Monthly Too
                  Lost sales
                  reports
                </div>
              </div>
            </div>

            {data.monthlyRevenue.length ===
            0 ? (
              <EmptyState text="No historical reports." />
            ) : (
              <div
                style={
                  revenueList
                }
              >
                {data.monthlyRevenue.map(
                  (
                    item
                  ) => {
                    const percentage =
                      maxRevenue >
                      0
                        ? Math.min(
                            100,
                            (item.total /
                              maxRevenue) *
                              100
                          )
                        : 0;

                    return (
                      <div
                        key={
                          item.date
                        }
                        style={
                          revenueRow
                        }
                      >
                        <div
                          style={
                            monthColumn
                          }
                        >
                          {formatMonth(
                            item.date
                          )}
                        </div>

                        <div
                          style={
                            revenueTrack
                          }
                        >
                          <div
                            style={{
                              ...revenueFill,
                              width: `${percentage}%`,
                            }}
                          />
                        </div>

                        <strong
                          style={
                            revenueMoney
                          }
                        >
                          {formatMoney(
                            item.total
                          )}
                        </strong>
                      </div>
                    );
                  }
                )}
              </div>
            )}
          </section>

          {/* STATUS */}

          <section
            style={
              apiStatusPanel
            }
          >
            <div>
              <strong>
                Too Lost API
                Status
              </strong>

              <div
                style={
                  smallMuted
                }
              >
                Last refreshed:{" "}
                {new Date(
                  data.generatedAt
                ).toLocaleString(
                  "en-IN"
                )}
              </div>
            </div>

            <span
              style={
                successBadge
              }
            >
              ● Connected
            </span>
          </section>
        </>
      )}
    </main>
  );
}

/* =========================================
   COMPONENTS
========================================= */

function StatCard({
  title,
  value,
  sub,
}: {
  title: string;
  value: string;
  sub: string;
}) {
  return (
    <div
      style={
        statCard
      }
    >
      <div
        style={
          statLabel
        }
      >
        {title}
      </div>

      <div
        style={
          statValue
        }
      >
        {value}
      </div>

      <div
        style={
          smallMuted
        }
      >
        {sub}
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div
      style={
        metricCard
      }
    >
      <div
        style={
          statLabel
        }
      >
        {label}
      </div>

      <div
        style={
          metricValue
        }
      >
        {value}
      </div>
    </div>
  );
}

function EmptyState({
  text,
}: {
  text: string;
}) {
  return (
    <div
      style={
        emptyBox
      }
    >
      {text}
    </div>
  );
}

function PlatformTrackRow({
  track,
  total,
}: {
  track: PlatformTrack;
  total: number;
}) {
  const percentage =
    total > 0
      ? Math.min(
          100,
          (Number(
            track.streams ||
              0
          ) /
            total) *
            100
        )
      : 0;

  return (
    <div
      style={
        trackRow
      }
    >
      <div
        style={
          trackArtworkWrap
        }
      >
        {track.cover ? (
          <img
            src={
              track.cover
            }
            alt={
              track.track ||
              track.title
            }
            style={
              trackArtwork
            }
          />
        ) : (
          <div
            style={
              trackFallback
            }
          >
            ♪
          </div>
        )}
      </div>

      <div
        style={{
          flex: 1,
          minWidth: 0,
        }}
      >
        <div
          style={
            trackName
          }
        >
          {track.track ||
            track.title ||
            "Untitled"}
        </div>

        <div
          style={
            smallMuted
          }
        >
          {track.release ||
            track.isrc ||
            "-"}
        </div>

        <div
          style={
            miniTrack
          }
        >
          <div
            style={{
              ...miniFill,
              width: `${percentage}%`,
            }}
          />
        </div>
      </div>

      <strong>
        {formatNumber(
          track.streams
        )}
      </strong>
    </div>
  );
}

function SimpleDataRow({
  name,
  value,
}: {
  name: string;
  value: string;
}) {
  return (
    <div
      style={
        simpleRow
      }
    >
      <span>
        {name}
      </span>

      <strong>
        {value}
      </strong>
    </div>
  );
}

/* =========================================
   HELPERS
========================================= */

function normalizeSourceData(
  value: any
): PlatformSource[] {
  const raw =
    value?.data ??
    value ??
    [];

  if (
    !Array.isArray(
      raw
    )
  ) {
    return [];
  }

  return raw.map(
    (
      item: any
    ) => ({
      platform_name:
        String(
          item?.platform_name ??
            item?.name ??
            item?.source ??
            "Unknown"
        ),

      streams:
        Number(
          item?.streams ??
            item?.events ??
            item?.total ??
            0
        ),
    })
  );
}

function prettyPlatformName(
  value: string
) {
  return value
    .replace(
      /[-_]/g,
      " "
    )
    .replace(
      /\b\w/g,
      (letter) =>
        letter.toUpperCase()
    );
}

function formatMoney(
  value: number
) {
  return new Intl.NumberFormat(
    "en-US",
    {
      style:
        "currency",

      currency:
        "USD",

      minimumFractionDigits:
        2,

      maximumFractionDigits:
        2,
    }
  ).format(
    value || 0
  );
}

function formatNumber(
  value: number
) {
  return new Intl.NumberFormat(
    "en-US"
  ).format(
    Number(
      value || 0
    )
  );
}

function formatCompactNumber(
  value: number
) {
  return new Intl.NumberFormat(
    "en-US",
    {
      notation:
        "compact",

      maximumFractionDigits:
        1,
    }
  ).format(
    value || 0
  );
}

function formatMonth(
  value: string
) {
  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return value;
  }

  return date.toLocaleDateString(
    "en-US",
    {
      month:
        "short",

      year:
        "numeric",
    }
  );
}

function formatShortDate(
  value: string
) {
  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return value;
  }

  return date.toLocaleDateString(
    "en-US",
    {
      month:
        "short",

      day:
        "numeric",
    }
  );
}

function periodLabel(
  period: Period
) {
  return (
    periodOptions.find(
      (item) =>
        item.value ===
        period
    )?.label ||
    period
  );
}

/* =========================================
   STYLES
========================================= */

const pageStyle:
  React.CSSProperties =
  {
    minHeight:
      "100vh",

    background:
      "#050816",

    color:
      "#ffffff",

    padding:
      "32px",
  };

const headerStyle:
  React.CSSProperties =
  {
    display:
      "flex",

    justifyContent:
      "space-between",

    alignItems:
      "flex-start",

    gap:
      "20px",

    paddingBottom:
      "24px",

    borderBottom:
      "1px solid #1c2938",
  };

const headerActions:
  React.CSSProperties =
  {
    display:
      "flex",

    gap:
      "10px",
  };

const badgeStyle:
  React.CSSProperties =
  {
    color:
      "#38bdf8",

    border:
      "1px solid #075985",

    background:
      "rgba(14,165,233,.08)",

    display:
      "inline-block",

    padding:
      "5px 8px",

    borderRadius:
      "6px",

    fontSize:
      "10px",

    fontWeight:
      800,
  };

const titleStyle:
  React.CSSProperties =
  {
    fontSize:
      "30px",

    margin:
      "10px 0 5px",
  };

const subtitleStyle:
  React.CSSProperties =
  {
    color:
      "#8292a7",

    margin: 0,

    fontSize:
      "13px",
  };

const selectStyle:
  React.CSSProperties =
  {
    background:
      "#08111d",

    color:
      "#fff",

    border:
      "1px solid #26364a",

    borderRadius:
      "8px",

    padding:
      "11px 13px",
  };

const refreshButton:
  React.CSSProperties =
  {
    background:
      "#1677ff",

    border: 0,

    color:
      "#ffffff",

    fontWeight:
      700,

    borderRadius:
      "8px",

    padding:
      "11px 16px",

    cursor:
      "pointer",
  };

const cardsGrid:
  React.CSSProperties =
  {
    display:
      "grid",

    gridTemplateColumns:
      "repeat(auto-fit,minmax(190px,1fr))",

    gap:
      "13px",

    marginTop:
      "22px",
  };

const statCard:
  React.CSSProperties =
  {
    background:
      "#0c1322",

    border:
      "1px solid #1c2b3e",

    borderRadius:
      "13px",

    padding:
      "18px",
  };

const statLabel:
  React.CSSProperties =
  {
    color:
      "#8495aa",

    fontSize:
      "11px",
  };

const statValue:
  React.CSSProperties =
  {
    fontSize:
      "24px",

    fontWeight:
      800,

    margin:
      "7px 0",
  };

const platformPanel:
  React.CSSProperties =
  {
    marginTop:
      "22px",

    background:
      "#08111d",

    border:
      "1px solid #18324a",

    borderRadius:
      "15px",

    overflow:
      "hidden",
  };

const platformTopBar:
  React.CSSProperties =
  {
    display:
      "flex",

    justifyContent:
      "space-between",

    alignItems:
      "center",

    gap:
      "20px",

    padding:
      "20px",

    borderBottom:
      "1px solid #183047",
  };

const platformBadge:
  React.CSSProperties =
  {
    color:
      "#38bdf8",

    fontSize:
      "10px",

    fontWeight:
      800,
  };

const platformTitle:
  React.CSSProperties =
  {
    margin:
      "6px 0 0",

    fontSize:
      "20px",
  };

const platformControls:
  React.CSSProperties =
  {
    display:
      "flex",

    gap:
      "10px",

    alignItems:
      "center",
  };

const platformSelect:
  React.CSSProperties =
  {
    minWidth:
      "190px",

    background:
      "#050c16",

    color:
      "#fff",

    border:
      "1px solid #23405a",

    borderRadius:
      "9px",

    padding:
      "10px 12px",
  };

const liveBadge:
  React.CSSProperties =
  {
    color:
      "#34d399",

    background:
      "#063625",

    borderRadius:
      "20px",

    padding:
      "7px 10px",

    fontSize:
      "10px",

    fontWeight:
      700,
  };

const platformCards:
  React.CSSProperties =
  {
    display:
      "grid",

    gridTemplateColumns:
      "repeat(auto-fit,minmax(180px,1fr))",

    gap:
      "12px",

    padding:
      "18px",
  };

const metricCard:
  React.CSSProperties =
  {
    border:
      "1px solid #1b3349",

    background:
      "#06101c",

    borderRadius:
      "11px",

    padding:
      "17px",
  };

const metricValue:
  React.CSSProperties =
  {
    fontSize:
      "26px",

    fontWeight:
      800,

    marginTop:
      "8px",
  };

const chartPanel:
  React.CSSProperties =
  {
    margin:
      "0 18px 18px",

    background:
      "#06101c",

    border:
      "1px solid #1b3349",

    borderRadius:
      "12px",

    padding:
      "18px",
  };

const sectionHeader:
  React.CSSProperties =
  {
    display:
      "flex",

    justifyContent:
      "space-between",

    alignItems:
      "center",

    gap:
      "14px",

    padding:
      "17px",
  };

const sectionTitle:
  React.CSSProperties =
  {
    margin: 0,

    fontSize:
      "16px",
  };

const bigTotal:
  React.CSSProperties =
  {
    fontSize:
      "22px",
  };

const chartArea:
  React.CSSProperties =
  {
    display:
      "flex",

    alignItems:
      "stretch",

    gap:
      "4px",

    height:
      "240px",

    overflowX:
      "auto",

    marginTop:
      "22px",
  };

const chartColumn:
  React.CSSProperties =
  {
    flex:
      "1 0 32px",

    minWidth:
      "32px",

    display:
      "flex",

    flexDirection:
      "column",

    alignItems:
      "center",
  };

const chartValueLabel:
  React.CSSProperties =
  {
    fontSize:
      "8px",

    color:
      "#718399",

    height:
      "18px",
  };

const chartTrack:
  React.CSSProperties =
  {
    width:
      "13px",

    flex: 1,

    display:
      "flex",

    alignItems:
      "flex-end",

    background:
      "#101b29",

    borderRadius:
      "5px",

    overflow:
      "hidden",
  };

const chartFill:
  React.CSSProperties =
  {
    width:
      "100%",

    minHeight:
      "2px",

    background:
      "linear-gradient(180deg,#8b5cf6,#2563eb)",

    borderRadius:
      "5px",
  };

const chartDate:
  React.CSSProperties =
  {
    color:
      "#607388",

    fontSize:
      "8px",

    marginTop:
      "6px",

    whiteSpace:
      "nowrap",
  };

const twoColumnGrid:
  React.CSSProperties =
  {
    display:
      "grid",

    gridTemplateColumns:
      "repeat(auto-fit,minmax(340px,1fr))",

    gap:
      "15px",

    margin:
      "0 18px 18px",
  };

const innerPanel:
  React.CSSProperties =
  {
    border:
      "1px solid #1b3349",

    background:
      "#06101c",

    borderRadius:
      "12px",

    overflow:
      "hidden",
  };

const trackRow:
  React.CSSProperties =
  {
    display:
      "flex",

    alignItems:
      "center",

    gap:
      "11px",

    padding:
      "13px 16px",

    borderTop:
      "1px solid #14273a",
  };

const trackArtworkWrap:
  React.CSSProperties =
  {
    width:
      "44px",

    height:
      "44px",

    flex:
      "0 0 44px",
  };

const trackArtwork:
  React.CSSProperties =
  {
    width:
      "44px",

    height:
      "44px",

    objectFit:
      "cover",

    borderRadius:
      "7px",
  };

const trackFallback:
  React.CSSProperties =
  {
    width:
      "44px",

    height:
      "44px",

    display:
      "flex",

    alignItems:
      "center",

    justifyContent:
      "center",

    background:
      "#152335",

    borderRadius:
      "7px",
  };

const trackName:
  React.CSSProperties =
  {
    fontWeight:
      700,

    fontSize:
      "12px",

    whiteSpace:
      "nowrap",

    overflow:
      "hidden",

    textOverflow:
      "ellipsis",
  };

const miniTrack:
  React.CSSProperties =
  {
    height:
      "4px",

    background:
      "#172638",

    borderRadius:
      "20px",

    overflow:
      "hidden",

    marginTop:
      "7px",
  };

const miniFill:
  React.CSSProperties =
  {
    height:
      "100%",

    background:
      "#8b5cf6",

    borderRadius:
      "20px",
  };

const sourcesPanel:
  React.CSSProperties =
  {
    margin:
      "0 18px 18px",

    background:
      "#06101c",

    border:
      "1px solid #1b3349",

    borderRadius:
      "12px",
  };

const simpleList:
  React.CSSProperties =
  {
    padding:
      "0 17px 10px",
  };

const simpleRow:
  React.CSSProperties =
  {
    display:
      "flex",

    justifyContent:
      "space-between",

    gap:
      "15px",

    padding:
      "13px 0",

    borderTop:
      "1px solid #14273a",

    fontSize:
      "12px",
  };

const panelStyle:
  React.CSSProperties =
  {
    marginTop:
      "22px",

    background:
      "#0c1322",

    border:
      "1px solid #1c2b3e",

    borderRadius:
      "14px",

    overflow:
      "hidden",
  };

const panelTitle:
  React.CSSProperties =
  {
    margin: 0,

    fontSize:
      "17px",
  };

const channelGrid:
  React.CSSProperties =
  {
    display:
      "grid",

    gridTemplateColumns:
      "repeat(auto-fit,minmax(220px,1fr))",

    gap:
      "12px",

    padding:
      "18px",
  };

const channelCard:
  React.CSSProperties =
  {
    display:
      "flex",

    alignItems:
      "center",

    gap:
      "12px",

    padding:
      "14px",

    border:
      "1px solid #1c2b3e",

    borderRadius:
      "10px",

    background:
      "#07101b",
  };

const channelLogoWrap:
  React.CSSProperties =
  {
    width:
      "40px",

    height:
      "40px",

    display:
      "flex",

    alignItems:
      "center",

    justifyContent:
      "center",

    background:
      "#132033",

    borderRadius:
      "8px",
  };

const channelLogo:
  React.CSSProperties =
  {
    width:
      "28px",

    maxHeight:
      "28px",

    objectFit:
      "contain",
  };

const channelName:
  React.CSSProperties =
  {
    color:
      "#a6b5c6",

    fontSize:
      "11px",

    marginBottom:
      "4px",
  };

const revenueList:
  React.CSSProperties =
  {
    padding:
      "18px",
  };

const revenueRow:
  React.CSSProperties =
  {
    display:
      "grid",

    gridTemplateColumns:
      "100px 1fr 100px",

    gap:
      "13px",

    alignItems:
      "center",

    marginBottom:
      "11px",
  };

const monthColumn:
  React.CSSProperties =
  {
    color:
      "#91a2b4",

    fontSize:
      "11px",
  };

const revenueTrack:
  React.CSSProperties =
  {
    height:
      "7px",

    background:
      "#152236",

    borderRadius:
      "50px",

    overflow:
      "hidden",
  };

const revenueFill:
  React.CSSProperties =
  {
    height:
      "100%",

    background:
      "linear-gradient(90deg,#2563eb,#22c55e)",

    borderRadius:
      "50px",
  };

const revenueMoney:
  React.CSSProperties =
  {
    textAlign:
      "right",

    fontSize:
      "11px",
  };

const apiStatusPanel:
  React.CSSProperties =
  {
    marginTop:
      "22px",

    display:
      "flex",

    justifyContent:
      "space-between",

    alignItems:
      "center",

    padding:
      "17px",

    border:
      "1px solid #1c2b3e",

    borderRadius:
      "12px",

    background:
      "#0c1322",
  };

const successBadge:
  React.CSSProperties =
  {
    color:
      "#4ade80",

    background:
      "#06361d",

    borderRadius:
      "8px",

    padding:
      "7px 10px",

    fontSize:
      "10px",
  };

const smallMuted:
  React.CSSProperties =
  {
    color:
      "#667b92",

    fontSize:
      "10px",

    marginTop:
      "4px",
  };

const emptyBox:
  React.CSSProperties =
  {
    padding:
      "35px",

    textAlign:
      "center",

    color:
      "#667b92",
  };

const errorBox:
  React.CSSProperties =
  {
    margin:
      "15px",

    color:
      "#fda4af",

    background:
      "#3a0b15",

    border:
      "1px solid #7f1d1d",

    padding:
      "12px",

    borderRadius:
      "8px",
  };