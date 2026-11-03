import { describe, expect, it } from "bun:test";
import { schemaOrgEvent } from "./event";

describe("schemaOrgEvent", () => {
    // Shapes observed live on 2026-11-03 (sockethub#1355).
    const luma = {
        "@context": "https://schema.org",
        "@type": "Event",
        name: "  ACM/IEEE Austin Tech Talks  ",
        startDate: "2026-11-09T18:00:00.000-06:00",
        endDate: "2026-11-09T20:00:00.000-06:00",
        eventStatus: "https://schema.org/EventScheduled",
        location: {
            "@type": "Place",
            name: "The Center for Government and Civic Service",
            address: {
                "@type": "PostalAddress",
                streetAddress: "1218 West Ave Bldg #3000",
                addressLocality: "Austin",
                addressRegion: "TX",
            },
        },
        url: "https://luma.com/2z1wvgyl",
        description: "long prose that must not pass through",
    };

    it("normalizes a bare Event node", () => {
        expect(schemaOrgEvent([luma])).toEqual({
            name: "ACM/IEEE Austin Tech Talks",
            startDate: "2026-11-09T18:00:00.000-06:00",
            endDate: "2026-11-09T20:00:00.000-06:00",
            location:
                "The Center for Government and Civic Service, 1218 West Ave Bldg #3000, Austin, TX",
            url: "https://luma.com/2z1wvgyl",
            status: "scheduled",
        });
    });

    it("finds the Event among sibling nodes, arrays and @graph wrappers", () => {
        const meetup = [
            { "@type": "Organization", name: "ACM Austin" },
            { "@type": "BreadcrumbList" },
            {
                "@graph": [
                    {
                        "@type": ["Event", "SocialEvent"],
                        name: "Meetup",
                        startDate: "2026-11-09",
                        eventStatus: "https://schema.org/EventCancelled",
                        location: {
                            "@type": "VirtualLocation",
                            url: "https://zoom.example/j/1",
                        },
                    },
                ],
            },
            { "@type": "RsvpAction" },
        ];
        expect(schemaOrgEvent([{ "@type": "WebPage" }, meetup])).toEqual({
            name: "Meetup",
            startDate: "2026-11-09",
            endDate: undefined,
            location: "https://zoom.example/j/1",
            url: undefined,
            status: "cancelled",
        });
    });

    it("ignores events without a name or start date, and non-event nodes", () => {
        expect(schemaOrgEvent([{ "@type": "Event", name: "no date" }])).toBe(
            undefined,
        );
        expect(schemaOrgEvent([{ "@type": "Product", name: "x" }])).toBe(
            undefined,
        );
        expect(schemaOrgEvent(undefined)).toBe(undefined);
        expect(schemaOrgEvent([null, "junk", 42])).toBe(undefined);
    });

    it("caps string length and drops non-string values", () => {
        const event = schemaOrgEvent([
            {
                "@type": "MusicEvent",
                name: "x".repeat(2000),
                startDate: "2026-11-09",
                location: { "@type": "Place", name: 123 },
                url: ["not", "a", "string"],
            },
        ]);
        expect(event?.name).toHaveLength(500);
        expect(event?.location).toBe(undefined);
        expect(event?.url).toBe(undefined);
    });
});
