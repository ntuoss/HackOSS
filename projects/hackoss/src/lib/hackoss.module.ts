import { NgModule } from '@angular/core';
import { EventsService } from './events/events.service';
import { LocationsService } from './locations/locations.service';
import { PeopleService } from './people/people.service';
import { FirebaseConfig, FIREBASE_CONFIG } from './firebase/firebase.config';

@NgModule({
  imports: [],
  providers: [
    EventsService,
    LocationsService,
    PeopleService
  ]
})
export class HackossModule {

  static forRoot(config: FirebaseConfig) {
    return {
      ngModule: HackossModule,
      providers: [{
        provide: FIREBASE_CONFIG,
        useValue: config
      }]
    };
  }

}
