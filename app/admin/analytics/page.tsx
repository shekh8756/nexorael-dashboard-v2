"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

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
  latestRevenueMonth: string | null;
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
  logoDark: string | null;
  logoDefault: string | null;
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
  monthlyRevenue: MonthlyRevenue[];
  channels: Channel[];
  tracks: Track[];
  topTracks: Track[];
  apiErrors: any[];
  error?: string;
};

type PlatformStreamPoint = {
  date: string;
  streams: number;
};

type PlatformTrack = {
  isrc: string;
  streams: number;
  track: string;
  title: string;
  release: string;
  cover: string | null;
};

type PlatformSource = {
  platform_name: string;
  streams: number;
};

type PlatformAnalyticsResponse = {
  success: boolean;
  platform: string;
  period: Period;
  release: string | null;

  overview: any;

  totalStreams: {
    data?: {
      totalStreams?: PlatformStreamPoint[];
      tracksTotal?: PlatformTrack[];
      streamsTotal?: number;
      countryTotal?: any[];
    };
  } | null;

  additional?: {
    sources?: {
      data?: PlatformSource[];
    };
    [key: string]: any;
  };

  apiStatus?: {
    overview?: number;
    totalStreams?: number;
  };

  generatedAt?: string;

  error?: string;
};

const periodOptions: {
  value: Period;
  label: string;
}[] = [
  {
    value: "lastSevenDays",
    label: "Last 7 Days",
  },
  {
    value: "lastThirtyDays",
    label: "Last 30 Days",
  },
  {
    value: "lastMonth",
    label: "Last Month",
  },
  {
    value: "lastThreeMonths",
    label: "Last 3 Months",
  },
  {
    value: "lastSixMonths",
    label: "Last 6 Months",
  },
  {
    value: "lastYear",
    label: "Last Year",
  },
  {
    value: "allTime",
    label: "All Time",
  },
];

export default function AdminAnalyticsPage() {
  const [period, setPeriod] =
    useState<Period>(
      "lastThirtyDays"
    );

  const [data, setData] =
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

  const [loading, setLoading] =
    useState(true);

  const [
    platformLoading,
    setPlatformLoading,
  ] = useState(true);

  const [error, setError] =
    useState("");

  const [
    platformError,
    setPlatformError,
  ] = useState("");

  /*
   * =========================================
   * GENERAL ANALYTICS
   * =========================================
   */

  const loadAnalytics =
    useCallback(async () => {
      setLoading(true);
      setError("");

      try {
        const response =
          await fetch(
            `/api/admin/analytics?period=${period}`,
            {
              method: "GET",
              cache: "no-store",
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

        setData(json);
      } catch (err) {
        console.error(err);

        setError(
          err instanceof Error
            ? err.message
            : "Unable to load analytics."
        );
      } finally {
        setLoading(false);
      }
    }, [period]);

  /*
   * =========================================
   * TIKTOK PLATFORM ANALYTICS
   * =========================================
   */

  const loadPlatformAnalytics =
    useCallback(async () => {
      setPlatformLoading(true);
      setPlatformError("");

      try {
        const response =
          await fetch(
            `/api/admin/analytics/platform?platform=tiktok&period=${period}`,
            {
              method: "GET",
              cache: "no-store",
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
              "Unable to load TikTok analytics."
          );
        }

        setPlatformData(json);
      } catch (err) {
        console.error(
          "Platform analytics:",
          err
        );

        setPlatformError(
          err instanceof Error
            ? err.message
            : "Unable to load platform analytics."
        );
      } finally {
        setPlatformLoading(
          false
        );
      }
    }, [period]);

  useEffect(() => {
    loadAnalytics();
    loadPlatformAnalytics();
  }, [
    loadAnalytics,
    loadPlatformAnalytics,
  ]);

  /*
   * =========================================
   * REVENUE CALCULATIONS
   * =========================================
   */

  const maxRevenue =
    useMemo(() => {
      if (
        !data?.monthlyRevenue
          ?.length
      ) {
        return 0;
      }

      return Math.max(
        ...data.monthlyRevenue.map(
          (item) => item.total
        ),
        0
      );
    }, [data]);

  /*
   * =========================================
   * PLATFORM DATA
   * =========================================
   */

  const platformStreams =
    platformData
      ?.totalStreams?.data
      ?.totalStreams || [];

  const platformTracks =
    platformData
      ?.totalStreams?.data
      ?.tracksTotal || [];

  const platformTotal =
    Number(
      platformData
        ?.totalStreams?.data
        ?.streamsTotal || 0
    );

  const platformSources =
    platformData?.additional
      ?.sources?.data || [];

  const sortedPlatformStreams =
    useMemo(() => {
      return [
        ...platformStreams,
      ].sort(
        (a, b) =>
          new Date(
            a.date
          ).getTime() -
          new Date(
            b.date
          ).getTime()
      );
    }, [platformStreams]);

  const maxPlatformStreams =
    useMemo(() => {
      if (
        sortedPlatformStreams
          .length === 0
      ) {
        return 0;
      }

      return Math.max(
        ...sortedPlatformStreams.map(
          (item) =>
            Number(
              item.streams || 0
            )
        ),
        0
      );
    }, [sortedPlatformStreams]);

  if (loading && !data) {
    return (
      <main style={pageStyle}>
        <h2>
          Loading Too Lost
          analytics...
        </h2>
      </main>
    );
  }

  return (
    <main style={pageStyle}>
      {/* HEADER */}

      <div style={headerStyle}>
        <div>
          <div style={badgeStyle}>
            TOO LOST API
          </div>

          <h1 style={titleStyle}>
            Analytics & Revenue
          </h1>

          <p style={subtitleStyle}>
            Revenue, DSP
            performance, platform
            views, streams and
            historical reports
            directly from Too Lost.
          </p>
        </div>

        <div
          style={headerActions}
        >
          <select
            value={period}
            onChange={(e) =>
              setPeriod(
                e.target
                  .value as Period
              )
            }
            style={selectStyle}
          >
            {periodOptions.map(
              (option) => (
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
            }}
            disabled={
              loading ||
              platformLoading
            }
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
        <div style={errorBox}>
          {error}
        </div>
      )}

      {data && (
        <>
          {/* SUMMARY CARDS */}

          <div
            style={cardsGrid}
          >
            <StatCard
              title="Total Reported Revenue"
              value={formatMoney(
                data.summary
                  .totalRevenue
              )}
              sub="Historical Too Lost sales"
            />

            <StatCard
              title="Latest Month Revenue"
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
              title="TikTok Views"
              value={
                platformLoading
                  ? "..."
                  : formatNumber(
                      platformTotal
                    )
              }
              sub={periodLabel(
                period
              )}
            />

            <StatCard
              title="Streams"
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
              value={String(
                data.summary
                  .totalChannels
              )}
              sub="Reporting channels"
            />

            <StatCard
              title="Saves"
              value={formatNumber(
                data.summary
                  .totalSaves
              )}
              sub="Analytics API"
            />

            <StatCard
              title="Skips"
              value={formatNumber(
                data.summary
                  .totalSkips
              )}
              sub="Analytics API"
            />

            <StatCard
              title="Tracks"
              value={String(
                data.summary
                  .totalTracks
              )}
              sub="Tracks in selected period"
            />
          </div>

          {/* ===================================
              TIKTOK PLATFORM ANALYTICS
          ==================================== */}

          <section
            style={platformPanel}
          >
            <div
              style={
                platformHeader
              }
            >
              <div>
                <div
                  style={
                    platformBadge
                  }
                >
                  PLATFORM ANALYTICS
                </div>

                <h2
                  style={
                    platformTitle
                  }
                >
                  TikTok Analytics
                </h2>

                <p
                  style={
                    panelSubtitle
                  }
                >
                  Real Too Lost
                  platform usage data.
                </p>
              </div>

              <div
                style={
                  platformStatusWrap
                }
              >
                <span
                  style={
                    connectedBadge
                  }
                >
                  ● LIVE API
                </span>
              </div>
            </div>

            {platformError && (
              <div
                style={errorBox}
              >
                {
                  platformError
                }
              </div>
            )}

            {platformLoading ? (
              <div
                style={emptyBox}
              >
                Loading TikTok
                analytics...
              </div>
            ) : (
              <>
                {/* PLATFORM SUMMARY */}

                <div
                  style={
                    platformStatsGrid
                  }
                >
                  <div
                    style={
                      platformStatCard
                    }
                  >
                    <div
                      style={
                        platformStatLabel
                      }
                    >
                      Total Views
                    </div>

                    <div
                      style={
                        platformBigValue
                      }
                    >
                      {formatNumber(
                        platformTotal
                      )}
                    </div>

                    <div
                      style={
                        statSub
                      }
                    >
                      TikTok
                    </div>
                  </div>

                  <div
                    style={
                      platformStatCard
                    }
                  >
                    <div
                      style={
                        platformStatLabel
                      }
                    >
                      Reporting
                      Tracks
                    </div>

                    <div
                      style={
                        platformBigValue
                      }
                    >
                      {
                        platformTracks.length
                      }
                    </div>

                    <div
                      style={
                        statSub
                      }
                    >
                      Tracks with
                      platform usage
                    </div>
                  </div>

                  <div
                    style={
                      platformStatCard
                    }
                  >
                    <div
                      style={
                        platformStatLabel
                      }
                    >
                      Traffic Sources
                    </div>

                    <div
                      style={
                        platformBigValue
                      }
                    >
                      {
                        platformSources.length
                      }
                    </div>

                    <div
                      style={
                        statSub
                      }
                    >
                      Too Lost
                      source records
                    </div>
                  </div>
                </div>

                {/* DAILY VIEW CHART */}

                <div
                  style={
                    chartSection
                  }
                >
                  <div
                    style={
                      chartHeader
                    }
                  >
                    <div>
                      <h3
                        style={
                          chartTitle
                        }
                      >
                        Views Over
                        Time
                      </h3>

                      <p
                        style={
                          panelSubtitle
                        }
                      >
                        Date-wise TikTok
                        views reported by
                        Too Lost
                      </p>
                    </div>

                    <span
                      style={
                        countBadge
                      }
                    >
                      {periodLabel(
                        period
                      )}
                    </span>
                  </div>

                  {sortedPlatformStreams.length ===
                  0 ? (
                    <EmptyState text="No TikTok timeline data available." />
                  ) : (
                    <div
                      style={
                        chartArea
                      }
                    >
                      {sortedPlatformStreams.map(
                        (
                          point
                        ) => {
                          const height =
                            maxPlatformStreams >
                            0
                              ? Math.max(
                                  3,
                                  (Number(
                                    point.streams ||
                                      0
                                  ) /
                                    maxPlatformStreams) *
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
                                  chartValue
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
                                  chartBarTrack
                                }
                              >
                                <div
                                  style={{
                                    ...chartBar,
                                    height: `${height}%`,
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

                {/* TOP TRACKS */}

                <div
                  style={
                    platformContentGrid
                  }
                >
                  <div
                    style={
                      innerPanel
                    }
                  >
                    <div
                      style={
                        innerPanelHeader
                      }
                    >
                      <div>
                        <h3
                          style={
                            chartTitle
                          }
                        >
                          Top Tracks
                        </h3>

                        <p
                          style={
                            panelSubtitle
                          }
                        >
                          TikTok views by
                          track
                        </p>
                      </div>

                      <span
                        style={
                          countBadge
                        }
                      >
                        {
                          platformTracks.length
                        }{" "}
                        tracks
                      </span>
                    </div>

                    {platformTracks.length ===
                    0 ? (
                      <EmptyState text="No track data available." />
                    ) : (
                      <div>
                        {platformTracks.map(
                          (
                            track,
                            index
                          ) => {
                            const percent =
                              platformTotal >
                              0
                                ? (Number(
                                    track.streams ||
                                      0
                                  ) /
                                    platformTotal) *
                                  100
                                : 0;

                            return (
                              <div
                                key={`${track.isrc}-${index}`}
                                style={
                                  platformTrackRow
                                }
                              >
                                <div
                                  style={
                                    rankNumber
                                  }
                                >
                                  {index +
                                    1}
                                </div>

                                <div
                                  style={
                                    artworkWrap
                                  }
                                >
                                  {track.cover ? (
                                    <img
                                      src={
                                        track.cover
                                      }
                                      alt={
                                        track.track
                                      }
                                      style={
                                        artwork
                                      }
                                    />
                                  ) : (
                                    <div
                                      style={
                                        artworkFallback
                                      }
                                    >
                                      ♪
                                    </div>
                                  )}
                                </div>

                                <div
                                  style={{
                                    flex: 1,
                                    minWidth:
                                      0,
                                  }}
                                >
                                  <div
                                    style={
                                      trackTitle
                                    }
                                  >
                                    {track.track ||
                                      track.title ||
                                      "Untitled"}
                                  </div>

                                  <div
                                    style={
                                      trackRelease
                                    }
                                  >
                                    {track.release ||
                                      "-"}
                                  </div>

                                  <div
                                    style={
                                      trackProgress
                                    }
                                  >
                                    <div
                                      style={{
                                        ...trackProgressFill,
                                        width: `${Math.min(
                                          100,
                                          percent
                                        )}%`,
                                      }}
                                    />
                                  </div>
                                </div>

                                <div
                                  style={
                                    trackViews
                                  }
                                >
                                  <strong>
                                    {formatNumber(
                                      track.streams
                                    )}
                                  </strong>

                                  <span
                                    style={
                                      trackViewsLabel
                                    }
                                  >
                                    views
                                  </span>
                                </div>
                              </div>
                            );
                          }
                        )}
                      </div>
                    )}
                  </div>

                  {/* SOURCES */}

                  <div
                    style={
                      innerPanel
                    }
                  >
                    <div
                      style={
                        innerPanelHeader
                      }
                    >
                      <div>
                        <h3
                          style={
                            chartTitle
                          }
                        >
                          Traffic
                          Sources
                        </h3>

                        <p
                          style={
                            panelSubtitle
                          }
                        >
                          Platform source
                          totals
                        </p>
                      </div>
                    </div>

                    {platformSources.length ===
                    0 ? (
                      <EmptyState text="No source data available." />
                    ) : (
                      <div
                        style={
                          sourceList
                        }
                      >
                        {platformSources.map(
                          (
                            source,
                            index
                          ) => (
                            <div
                              key={`${source.platform_name}-${index}`}
                              style={
                                sourceRow
                              }
                            >
                              <div>
                                <div
                                  style={
                                    sourceName
                                  }
                                >
                                  {
                                    source.platform_name
                                  }
                                </div>

                                <div
                                  style={
                                    sourceSub
                                  }
                                >
                                  Platform
                                  source
                                </div>
                              </div>

                              <strong
                                style={
                                  sourceValue
                                }
                              >
                                {formatNumber(
                                  source.streams
                                )}
                              </strong>
                            </div>
                          )
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </section>

          {/* DSP REVENUE */}

          <section
            style={panelStyle}
          >
            <div
              style={panelHeader}
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

                <p
                  style={
                    panelSubtitle
                  }
                >
                  Actual channel
                  earnings reported by
                  Too Lost
                </p>
              </div>

              <span
                style={countBadge}
              >
                {
                  data.channels
                    .length
                }{" "}
                channels
              </span>
            </div>

            {data.channels
              .length === 0 ? (
              <EmptyState text="No channel revenue available." />
            ) : (
              <div
                style={
                  channelGrid
                }
              >
                {data.channels.map(
                  (channel) => (
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
                          <span>
                            ♪
                          </span>
                        )}
                      </div>

                      <div
                        style={{
                          flex: 1,
                        }}
                      >
                        <div
                          style={
                            channelName
                          }
                        >
                          {
                            channel.name
                          }
                        </div>

                        <div
                          style={
                            channelRevenue
                          }
                        >
                          {formatMoney(
                            channel.total
                          )}
                        </div>
                      </div>
                    </div>
                  )
                )}
              </div>
            )}
          </section>

          {/* MONTHLY REVENUE */}

          <section
            style={panelStyle}
          >
            <div
              style={panelHeader}
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

                <p
                  style={
                    panelSubtitle
                  }
                >
                  Previous Too Lost
                  sales reporting
                  periods
                </p>
              </div>

              <span
                style={countBadge}
              >
                {
                  data.monthlyRevenue
                    .length
                }{" "}
                reports
              </span>
            </div>

            {data.monthlyRevenue
              .length === 0 ? (
              <EmptyState text="No historical reports found." />
            ) : (
              <div
                style={
                  revenueListStyle
                }
              >
                {data.monthlyRevenue.map(
                  (item) => {
                    const percent =
                      maxRevenue > 0
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
                            barTrack
                          }
                        >
                          <div
                            style={{
                              ...barFill,
                              width: `${percent}%`,
                            }}
                          />
                        </div>

                        <div
                          style={
                            moneyColumn
                          }
                        >
                          {formatMoney(
                            item.total
                          )}
                        </div>
                      </div>
                    );
                  }
                )}
              </div>
            )}
          </section>

          {/* GENERAL TRACK ANALYTICS */}

          <section
            style={panelStyle}
          >
            <div
              style={panelHeader}
            >
              <div>
                <h2
                  style={
                    panelTitle
                  }
                >
                  Track Analytics
                </h2>

                <p
                  style={
                    panelSubtitle
                  }
                >
                  Streams, saves,
                  skips and engagement
                </p>
              </div>

              <span
                style={countBadge}
              >
                {periodLabel(
                  period
                )}
              </span>
            </div>

            {data.topTracks
              .length === 0 ? (
              <div
                style={emptyBox}
              >
                <div
                  style={{
                    fontSize:
                      "32px",
                  }}
                >
                  ♫
                </div>

                <h3>
                  No track analytics
                  for this period
                </h3>

                <p>
                  Try selecting{" "}
                  <strong>
                    All Time
                  </strong>{" "}
                  to check older Too
                  Lost analytics
                  data.
                </p>
              </div>
            ) : (
              <div
                style={tableWrap}
              >
                <table
                  style={tableStyle}
                >
                  <thead>
                    <tr>
                      <th
                        style={
                          thStyle
                        }
                      >
                        Track
                      </th>

                      <th
                        style={
                          thStyle
                        }
                      >
                        Release
                      </th>

                      <th
                        style={
                          thStyle
                        }
                      >
                        ISRC
                      </th>

                      <th
                        style={
                          thStyle
                        }
                      >
                        Streams
                      </th>

                      <th
                        style={
                          thStyle
                        }
                      >
                        Saves
                      </th>

                      <th
                        style={
                          thStyle
                        }
                      >
                        Skips
                      </th>

                      <th
                        style={
                          thStyle
                        }
                      >
                        Engagement
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {data.topTracks.map(
                      (
                        track,
                        index
                      ) => (
                        <tr
                          key={`${track.isrc}-${index}`}
                        >
                          <td
                            style={
                              tdStyle
                            }
                          >
                            {track.track ||
                              "-"}
                          </td>

                          <td
                            style={
                              tdStyle
                            }
                          >
                            {track.release ||
                              "-"}
                          </td>

                          <td
                            style={
                              tdStyle
                            }
                          >
                            {track.isrc ||
                              "-"}
                          </td>

                          <td
                            style={
                              tdStyle
                            }
                          >
                            {formatNumber(
                              track.totalStreams
                            )}
                          </td>

                          <td
                            style={
                              tdStyle
                            }
                          >
                            {formatNumber(
                              track.totalSaves
                            )}
                          </td>

                          <td
                            style={
                              tdStyle
                            }
                          >
                            {formatNumber(
                              track.totalSkips
                            )}
                          </td>

                          <td
                            style={
                              tdStyle
                            }
                          >
                            {track.engagement.toFixed(
                              2
                            )}
                            %
                          </td>
                        </tr>
                      )
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* API STATUS */}

          <section
            style={statusPanel}
          >
            <div>
              <strong>
                Too Lost API Status
              </strong>

              <div
                style={
                  statusSubtitle
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
                data.apiErrors
                  .length === 0
                  ? successBadge
                  : warningBadge
              }
            >
              {data.apiErrors
                .length === 0
                ? "● All APIs Connected"
                : `${data.apiErrors.length} API Error(s)`}
            </span>
          </section>
        </>
      )}
    </main>
  );
}

/* ====================================
   COMPONENTS
==================================== */

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
    <div style={statCard}>
      <div style={statTitle}>
        {title}
      </div>

      <div style={statValue}>
        {value}
      </div>

      <div style={statSub}>
        {sub}
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
    <div style={emptyBox}>
      {text}
    </div>
  );
}

/* ====================================
   FORMATTERS
==================================== */

function formatMoney(
  value: number
) {
  return new Intl.NumberFormat(
    "en-US",
    {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }
  ).format(value || 0);
}

function formatNumber(
  value: number
) {
  return new Intl.NumberFormat(
    "en-US"
  ).format(value || 0);
}

function formatCompactNumber(
  value: number
) {
  return new Intl.NumberFormat(
    "en-US",
    {
      notation: "compact",
      maximumFractionDigits: 1,
    }
  ).format(value || 0);
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
      month: "short",
      year: "numeric",
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
      month: "short",
      day: "numeric",
    }
  );
}

function periodLabel(
  period: Period
) {
  return (
    periodOptions.find(
      (item) =>
        item.value === period
    )?.label || period
  );
}

/* ====================================
   STYLES
==================================== */

const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  background: "#050816",
  color: "#fff",
  padding: "34px",
};

const headerStyle: React.CSSProperties = {
  display: "flex",
  justifyContent:
    "space-between",
  alignItems: "flex-start",
  gap: "20px",
  borderBottom:
    "1px solid #1f2937",
  paddingBottom: "26px",
};

const headerActions: React.CSSProperties = {
  display: "flex",
  gap: "10px",
};

const badgeStyle: React.CSSProperties = {
  display: "inline-block",
  color: "#60a5fa",
  border:
    "1px solid #1d4ed8",
  borderRadius: "6px",
  padding: "5px 8px",
  fontSize: "11px",
  fontWeight: 700,
};

const titleStyle: React.CSSProperties = {
  margin: "10px 0 6px",
  fontSize: "30px",
};

const subtitleStyle: React.CSSProperties = {
  margin: 0,
  color: "#94a3b8",
};

const selectStyle: React.CSSProperties = {
  background: "#090c14",
  border:
    "1px solid #293241",
  color: "#fff",
  padding: "11px 14px",
  borderRadius: "8px",
};

const refreshButton: React.CSSProperties = {
  background: "#2563eb",
  color: "#fff",
  border: 0,
  borderRadius: "8px",
  padding: "11px 16px",
  cursor: "pointer",
  fontWeight: 700,
};

const cardsGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit,minmax(190px,1fr))",
  gap: "14px",
  marginTop: "24px",
};

const statCard: React.CSSProperties = {
  background: "#0d1224",
  border:
    "1px solid #20283a",
  borderRadius: "14px",
  padding: "20px",
};

const statTitle: React.CSSProperties = {
  color: "#94a3b8",
  fontSize: "12px",
};

const statValue: React.CSSProperties = {
  fontSize: "25px",
  fontWeight: 800,
  marginTop: "8px",
};

const statSub: React.CSSProperties = {
  color: "#64748b",
  marginTop: "7px",
  fontSize: "12px",
};

const panelStyle: React.CSSProperties = {
  background: "#0d1224",
  border:
    "1px solid #20283a",
  borderRadius: "16px",
  marginTop: "22px",
  overflow: "hidden",
};

const panelHeader: React.CSSProperties = {
  display: "flex",
  justifyContent:
    "space-between",
  alignItems: "center",
  padding: "20px",
  borderBottom:
    "1px solid #20283a",
};

const panelTitle: React.CSSProperties = {
  margin: 0,
  fontSize: "18px",
};

const panelSubtitle: React.CSSProperties = {
  margin: "5px 0 0",
  color: "#64748b",
  fontSize: "12px",
};

const countBadge: React.CSSProperties = {
  background: "#151b2c",
  color: "#cbd5e1",
  borderRadius: "8px",
  padding: "7px 10px",
  fontSize: "12px",
};

const channelGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit,minmax(250px,1fr))",
  gap: "12px",
  padding: "20px",
};

const channelCard: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "14px",
  padding: "14px",
  border:
    "1px solid #20283a",
  borderRadius: "12px",
  background: "#090d19",
};

const channelLogoWrap: React.CSSProperties = {
  width: "42px",
  height: "42px",
  borderRadius: "10px",
  background: "#151b2c",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const channelLogo: React.CSSProperties = {
  maxWidth: "30px",
  maxHeight: "30px",
  objectFit: "contain",
};

const channelName: React.CSSProperties = {
  fontSize: "13px",
  color: "#cbd5e1",
};

const channelRevenue: React.CSSProperties = {
  marginTop: "5px",
  fontSize: "17px",
  fontWeight: 800,
};

const revenueListStyle: React.CSSProperties = {
  padding: "20px",
};

const revenueRow: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "110px 1fr 110px",
  alignItems: "center",
  gap: "15px",
  marginBottom: "12px",
};

const monthColumn: React.CSSProperties = {
  color: "#94a3b8",
  fontSize: "12px",
};

const barTrack: React.CSSProperties = {
  background: "#171e30",
  height: "8px",
  borderRadius: "99px",
  overflow: "hidden",
};

const barFill: React.CSSProperties = {
  height: "100%",
  background:
    "linear-gradient(90deg,#2563eb,#22c55e)",
  borderRadius: "99px",
};

const moneyColumn: React.CSSProperties = {
  textAlign: "right",
  fontWeight: 700,
  fontSize: "12px",
};

const tableWrap: React.CSSProperties = {
  overflowX: "auto",
};

const tableStyle: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
};

const thStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "13px 16px",
  color: "#64748b",
  fontSize: "11px",
  borderBottom:
    "1px solid #20283a",
};

const tdStyle: React.CSSProperties = {
  padding: "14px 16px",
  borderBottom:
    "1px solid #161d2d",
  fontSize: "13px",
};

const emptyBox: React.CSSProperties = {
  padding: "42px",
  textAlign: "center",
  color: "#64748b",
};

const errorBox: React.CSSProperties = {
  marginTop: "20px",
  background: "#350a12",
  border:
    "1px solid #7f1d1d",
  color: "#fca5a5",
  padding: "14px",
  borderRadius: "10px",
};

const statusPanel: React.CSSProperties = {
  marginTop: "22px",
  background: "#0d1224",
  border:
    "1px solid #20283a",
  borderRadius: "14px",
  padding: "18px",
  display: "flex",
  justifyContent:
    "space-between",
  alignItems: "center",
};

const statusSubtitle: React.CSSProperties = {
  color: "#64748b",
  fontSize: "11px",
  marginTop: "5px",
};

const successBadge: React.CSSProperties = {
  color: "#4ade80",
  background: "#052e1a",
  padding: "8px 11px",
  borderRadius: "8px",
  fontSize: "12px",
};

const warningBadge: React.CSSProperties = {
  color: "#fbbf24",
  background: "#422006",
  padding: "8px 11px",
  borderRadius: "8px",
  fontSize: "12px",
};

/* PLATFORM STYLES */

const platformPanel: React.CSSProperties = {
  marginTop: "22px",
  border:
    "1px solid #17334a",
  background:
    "linear-gradient(180deg,#081523,#091321)",
  borderRadius: "16px",
  padding: "20px",
};

const platformHeader: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent:
    "space-between",
  gap: "20px",
  paddingBottom: "18px",
  borderBottom:
    "1px solid #183047",
};

const platformBadge: React.CSSProperties = {
  display: "inline-block",
  color: "#38bdf8",
  fontSize: "10px",
  fontWeight: 800,
  letterSpacing: ".08em",
};

const platformTitle: React.CSSProperties = {
  margin: "7px 0 0",
  fontSize: "21px",
};

const platformStatusWrap: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
};

const connectedBadge: React.CSSProperties = {
  color: "#34d399",
  background:
    "rgba(6,78,59,.4)",
  border:
    "1px solid rgba(16,185,129,.22)",
  borderRadius: "20px",
  padding: "7px 11px",
  fontSize: "11px",
  fontWeight: 700,
};

const platformStatsGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit,minmax(180px,1fr))",
  gap: "12px",
  marginTop: "18px",
};

const platformStatCard: React.CSSProperties = {
  background: "#07101c",
  border:
    "1px solid #193149",
  borderRadius: "12px",
  padding: "18px",
};

const platformStatLabel: React.CSSProperties = {
  color: "#7f94aa",
  fontSize: "11px",
};

const platformBigValue: React.CSSProperties = {
  fontSize: "28px",
  fontWeight: 800,
  marginTop: "7px",
};

const chartSection: React.CSSProperties = {
  marginTop: "18px",
  background: "#07101c",
  border:
    "1px solid #193149",
  borderRadius: "13px",
  padding: "18px",
};

const chartHeader: React.CSSProperties = {
  display: "flex",
  justifyContent:
    "space-between",
  alignItems: "center",
};

const chartTitle: React.CSSProperties = {
  margin: 0,
  fontSize: "15px",
};

const chartArea: React.CSSProperties = {
  height: "260px",
  display: "flex",
  alignItems: "stretch",
  gap: "5px",
  marginTop: "28px",
  overflowX: "auto",
  paddingBottom: "6px",
};

const chartColumn: React.CSSProperties = {
  minWidth: "35px",
  flex: "1 0 35px",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
};

const chartValue: React.CSSProperties = {
  height: "20px",
  color: "#7890a6",
  fontSize: "9px",
};

const chartBarTrack: React.CSSProperties = {
  flex: 1,
  width: "13px",
  display: "flex",
  alignItems: "flex-end",
  background:
    "rgba(30,41,59,.25)",
  borderRadius: "5px",
  overflow: "hidden",
};

const chartBar: React.CSSProperties = {
  width: "100%",
  minHeight: "2px",
  background:
    "linear-gradient(180deg,#38bdf8,#2563eb)",
  borderRadius: "5px",
};

const chartDate: React.CSSProperties = {
  color: "#64748b",
  fontSize: "8px",
  marginTop: "7px",
  whiteSpace: "nowrap",
};

const platformContentGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "minmax(0,2fr) minmax(260px,1fr)",
  gap: "14px",
  marginTop: "18px",
};

const innerPanel: React.CSSProperties = {
  border:
    "1px solid #193149",
  background: "#07101c",
  borderRadius: "13px",
  overflow: "hidden",
};

const innerPanelHeader: React.CSSProperties = {
  display: "flex",
  justifyContent:
    "space-between",
  alignItems: "center",
  gap: "10px",
  padding: "17px",
  borderBottom:
    "1px solid #17283b",
};

const platformTrackRow: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "12px",
  padding: "14px 16px",
  borderBottom:
    "1px solid #132335",
};

const rankNumber: React.CSSProperties = {
  width: "22px",
  color: "#64748b",
  fontSize: "11px",
};

const artworkWrap: React.CSSProperties = {
  width: "46px",
  height: "46px",
  flex: "0 0 46px",
};

const artwork: React.CSSProperties = {
  width: "46px",
  height: "46px",
  borderRadius: "8px",
  objectFit: "cover",
};

const artworkFallback: React.CSSProperties = {
  width: "46px",
  height: "46px",
  borderRadius: "8px",
  background: "#152538",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const trackTitle: React.CSSProperties = {
  color: "#e2e8f0",
  fontSize: "12px",
  fontWeight: 700,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const trackRelease: React.CSSProperties = {
  color: "#64748b",
  fontSize: "10px",
  marginTop: "3px",
};

const trackProgress: React.CSSProperties = {
  height: "4px",
  background: "#16283a",
  borderRadius: "10px",
  marginTop: "8px",
  overflow: "hidden",
};

const trackProgressFill: React.CSSProperties = {
  height: "100%",
  background: "#38bdf8",
  borderRadius: "10px",
};

const trackViews: React.CSSProperties = {
  textAlign: "right",
  minWidth: "70px",
  fontSize: "12px",
};

const trackViewsLabel: React.CSSProperties = {
  display: "block",
  color: "#64748b",
  fontSize: "9px",
  marginTop: "3px",
};

const sourceList: React.CSSProperties = {
  padding: "8px 16px",
};

const sourceRow: React.CSSProperties = {
  display: "flex",
  justifyContent:
    "space-between",
  alignItems: "center",
  padding: "14px 0",
  borderBottom:
    "1px solid #152537",
};

const sourceName: React.CSSProperties = {
  fontWeight: 700,
  fontSize: "12px",
};

const sourceSub: React.CSSProperties = {
  color: "#64748b",
  fontSize: "9px",
  marginTop: "3px",
};

const sourceValue: React.CSSProperties = {
  color: "#38bdf8",
  fontSize: "14px",
};