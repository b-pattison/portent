Rails.application.routes.draw do
  get "encounters/show"
  get "characters/new"
  get "characters/create"
  get "characters/edit"
  get "characters/update"
  get "characters/destroy"
  get "campaigns/index"
  get "pages/home"
  get "home/index"
  devise_for :users
  
    authenticated :user do
      root to: "campaigns#index", as: :authenticated_root
    end

    
  
    unauthenticated :user do
      root to: "pages#home"
    end
  
    
    resources :campaigns, only: %i[index create show] do
      member do
        post :start_encounter  # or use 'post' if using button_to
      end
      resources :characters, only: %i[new create edit update destroy]
      resources :encounters, only: %i[show]
    end

  
  # Define your application routes per the DSL in https://guides.rubyonrails.org/routing.html

  # Reveal health status on /up that returns 200 if the app boots with no exceptions, otherwise 500.
  # Can be used by load balancers and uptime monitors to verify that the app is live.
  get "up" => "rails/health#show", as: :rails_health_check

  # Render dynamic PWA files from app/views/pwa/* (remember to link manifest in application.html.erb)
  # get "manifest" => "rails/pwa#manifest", as: :pwa_manifest
  # get "service-worker" => "rails/pwa#service_worker", as: :pwa_service_worker

  # Defines the root path route ("/")
  # root "posts#index"
end
