import { FirebaseRepository } from '../firebase/firebase.repository';
import { PeopleRepository } from '../people/people.repository';
import { LocationsRepository } from '../locations/locations.repository';
import { Event, Speaker, Prerequisite, Dependency, EventStatus, Publication } from './event';
import { FirebaseEvent, FirebaseEventSpeaker } from './event.firebase';
import { OrganisationsRepository } from '../organisations/organisations.repository';
import { ArtworksRepository } from '../artworks/artworks.repository';
import { QueryFilter, buildQuery } from '../utils';
import { validators } from 'validate.js';
import firebase from 'firebase/app';

export type EventsOrderKey = 'date' | 'title';

const EVENTS_ORDER_KEY_PATH_MAP: { [key in EventsOrderKey]: string; } = {
    'date': 'startTime',
    'title': 'title'
};

export interface NewEvent {
    tgif: number;
    title: string;
    endTime: Date;
    tagline: string;
    bannerId: string;
    prerequisites: Prerequisite[];
    description: string;
    startTime: Date;
    dependencies: Dependency[];
    promotion: string;
    venueId: string;
    githubUrl: string;
    status: EventStatus;
    isPublic: boolean;
    isExternal: boolean;
    hasFood: boolean;
    hasDrinks: boolean;
    remarks: string;
    eventbrite: Publication;
    facebook: Publication;
    speakers: {
        personId: string;
        organisationId: string;
        position: string;
    }[];
}

export class EventsRepository {

    private firebaseRepository: FirebaseRepository;
    private peopleRepository: PeopleRepository;
    private locationRepository: LocationsRepository;
    private organisationsRepository: OrganisationsRepository;
    private artworksRepository: ArtworksRepository;
    events: firebase.firestore.CollectionReference;

    constructor(
        firebaseRepository: FirebaseRepository,
        peopleRepository: PeopleRepository,
        locationRepository: LocationsRepository,
        organisationsRepository: OrganisationsRepository,
        artworksRepository: ArtworksRepository
    ) {

        this.firebaseRepository = firebaseRepository;
        this.peopleRepository = peopleRepository;
        this.locationRepository = locationRepository;
        this.organisationsRepository = organisationsRepository;
        this.artworksRepository = artworksRepository;

        this.events = this.firebaseRepository.firestore.collection('events');

        validators.tgifUnique = (tgif: number) => new Promise(async (resolve) => {
            const doc = await this.events.where('tgif', '==', tgif).get();
            if (doc.docs.length === 0) {
                resolve();
            } else {
                resolve(`Event with TGIFHacks # ${tgif} already exists in Firebase`);
            }
        });
    }

    createEvent = (event: NewEvent) =>
        this.events.add({
            ...event,
            startTime: firebase.firestore.Timestamp.fromDate(event.startTime),
            endTime: firebase.firestore.Timestamp.fromDate(event.endTime),
            banner: this.artworksRepository.artworks.doc(event.bannerId),
            venue: this.locationRepository.locations.doc(event.venueId),
            speakers: event.speakers.map<FirebaseEventSpeaker>(speaker => ({
                ...speaker,
                person: this.peopleRepository.people.doc(speaker.personId),
                organisation: this.organisationsRepository.organisations.doc(speaker.organisationId),
            }))
        })

    async getEvents(
        filters: QueryFilter[] = [],
        limit: number = 10,
        orderBy: EventsOrderKey = 'date',
        direction: firebase.firestore.OrderByDirection = 'desc'
    ): Promise<Event[]> {
        const orderByPath = EVENTS_ORDER_KEY_PATH_MAP[orderBy];
        const results = await buildQuery(this.events, limit, orderByPath, direction, filters).get();
        return Promise.all(results.docs.map(doc => this.toEvent({ ...doc.data() as FirebaseEvent, id: doc.id })));
    }

    async getEvent(id: string): Promise<Event> {
        const ref = this.events.doc(id);
        const doc = await ref.get();
        return this.toEvent({ ...doc.data() as FirebaseEvent, id });
    }

    private async toEvent(data: FirebaseEvent): Promise<Event> {

        const speakers = data.speakers.map(async (speaker): Promise<Speaker> => {
            const person = this.peopleRepository.getPerson(speaker.person.id);
            const organisation = this.organisationsRepository.getOrganisation(speaker.organisation.id);
            return {
                person: await person,
                organisation: await organisation,
                position: speaker.position
            };
        });

        const banner = this.artworksRepository.getArtwork(data.banner.id);
        const venue = this.locationRepository.getLocation(data.venue.id);

        return {
            ...data,
            speakers: await Promise.all(speakers),
            banner: await banner,
            venue: await venue,
            startTime: data.startTime.toDate(),
            endTime: data.endTime.toDate()
        };
    }
}
