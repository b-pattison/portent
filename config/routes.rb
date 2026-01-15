Rails.application.routes.draw do
  devise_for :users

  authenticated :user do
    root to: "campaigns#index", as: :authenticated_root
  end

  unauthenticated :user do
    root to: "pages#home"
  end

  resources :campaigns, only: %i[index create show] do
    member do
      post :start_encounter
    end

    resources :characters, only: %i[new create edit update destroy]

    resources :encounters, only: %i[show] do
      member do
        post  :add_combatant
        post  :advance_turn
        patch :update_rolls
        patch :end_encounter
        get   :state
    
        # Effects
        post  :effects, to: "encounter_effects#create"
        get   :effects, to: "encounter_effects#index"
        post  "effect_targets/:target_id/resolve", to: "effect_targets#resolve", as: :resolve_effect_target
        delete "effects/:effect_id", to: "encounter_effects#destroy", as: :end_effect
      end

      resources :encounter_participants, only: [] do
        member do
          patch :remove
          patch :restore
          patch :update
        end
      end
    end
  end

  get "up" => "rails/health#show", as: :rails_health_check
end
