import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EditMp3Component } from './edit-mp3.component';

describe('EditMp3Component', () => {
  let component: EditMp3Component;
  let fixture: ComponentFixture<EditMp3Component>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [EditMp3Component]
    })
    .compileComponents();

    fixture = TestBed.createComponent(EditMp3Component);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
