class EncountersController < ApplicationController
  before_action :authenticate_user!
  before_action :ensure_not_ended, only: %i[update_rolls add_combatant advance_turn]
  before_action :set_campaign
  before_action :set_encounter, only: %i[show update_rolls add_combatant end_encounter restore_encounter state advance_turn ensure_not_ended]

  def state
    render json: Encounters::StatePresenter.new(@encounter).as_json
  end

  def advance_turn
    result = Encounters::AdvanceTurnService.new(@encounter).call!
    @encounter.reload
    
    state_data = Encounters::StatePresenter.new(@encounter).as_json
    
    if result[:status] == :interrupt
      render json: {
        status: "interrupt",
        interrupt: result[:interrupt],
        encounter: state_data[:encounter],
        participants: state_data[:participants],
        dead_participants: state_data[:dead_participants]
      }
    else
      render json: {
        status: "ok",
        encounter: state_data[:encounter],
        participants: state_data[:participants],
        dead_participants: state_data[:dead_participants]
      }
    end
  end

  def show
    seed_from_pcs_if_empty!(@encounter, @campaign)

    activate_if_ready!

    @participants = @encounter.encounter_participants
                              .includes(:character)
                              .order(:id)

    @new_combatant = @encounter.encounter_participants.new
    @missing_rolls = @participants.reject { |p| p.state == "removed" }
                                  .any? { |p| p.initiative_roll.nil? }
    
    existing_participant_ids = @encounter.encounter_participants.pluck(:character_id)
    @available_npcs = @campaign.characters.npcs.permanent.where.not(id: existing_participant_ids)
    @available_pcs = @campaign.characters.pcs.permanent.where.not(id: existing_participant_ids)
  end

  def update_rolls
    active_participants = @encounter.encounter_participants.where.not(state: "removed")
    
    submitted_ids = participants_params.keys.map(&:to_i)
    active_ids = active_participants.pluck(:id)
    
    missing_from_params = (active_ids - submitted_ids).any?
    if missing_from_params
      redirect_to [@campaign, @encounter], 
                  alert: "All combatants must have an initiative roll before the encounter can start."
      return
    end
    
    missing_rolls = active_ids.any? do |id|
      attrs = participants_params[id.to_s]
      attrs[:initiative_roll].blank?
    end
    
    if missing_rolls
      redirect_to [@campaign, @encounter], 
                  alert: "All combatants must have an initiative roll before the encounter can start."
      return
    end

    participants_params.each do |participant_id, attrs|
      participant = @encounter.encounter_participants.find(participant_id)

      next if participant.state == "removed"

      roll = attrs[:initiative_roll].presence&.to_i
      mod  = participant.initiative_mod.to_i

      participant.update!(
        initiative_roll: roll,
        initiative_total: roll.nil? ? nil : roll + mod
      )
    end

    @encounter.reload

    activate_if_ready!

    redirect_to [@campaign, @encounter],
                notice: (@encounter.status == "active" ? "Encounter is active!" : "Initiative saved!")
  end

  def add_combatant
    if params[:character_id].present?
      character = @campaign.characters.find(params[:character_id])
      unless character.permanent?
        redirect_to [@campaign, @encounter], alert: "Invalid character selected."
        return
      end
    else
      character = @campaign.characters.create!(
        name: params.require(:character).fetch(:name),
        pc: false,
        temporary: true,
        initiative_mod: params.require(:character).fetch(:initiative_mod).to_i
      )

      if params[:character][:avatar].present?
        character.avatar.attach(params[:character][:avatar])
      end
    end

    was_active = @encounter.status == "active"
    
    added_in_round = was_active ? @encounter.round_number + 1 : nil
    
    participant = @encounter.encounter_participants.create!(
      character: character,
      initiative_mod: character.initiative_mod,
      state: "alive",
      added_in_round: added_in_round
    )

    if params[:character] && params[:character][:initiative_roll].present?
      roll = params[:character][:initiative_roll].to_i
      mod = participant.initiative_mod.to_i
      participant.update!(
        initiative_roll: roll,
        initiative_total: roll + mod
      )
    end

    if was_active
      redirect_to [@campaign, @encounter], notice: "Combatant added! They will join the initiative order at the start of round #{added_in_round}."
    else
      redirect_to [@campaign, @encounter], notice: "Combatant added!"
    end
  end

  def end_encounter
    @encounter.update!(
      status: "ended",
      last_active_participant_id: @encounter.active_participant_id,
      active_participant_id: nil
    )

    redirect_to campaign_path(@campaign), notice: "Encounter ended."
  end

  def restore_encounter
    if @campaign.encounters.active.exists?
      render json: { 
        error: "Encounter already started. Please end current encounter to start a new one." 
      }, status: :unprocessable_entity
      return
    end

    # If last_active_participant_id is nil, find the first participant in initiative order
    active_participant_id = @encounter.last_active_participant_id
    if active_participant_id.nil?
      ordered_participants = @encounter.encounter_participants
                                        .where.not(state: ["removed", "dead"])
                                        .where.not(initiative_roll: nil)
                                        .order(initiative_total: :desc, initiative_mod: :desc, id: :asc)
      active_participant_id = ordered_participants.first&.id
    end

    @encounter.update!(
      status: "active",
      active_participant_id: active_participant_id
    )

    render json: { 
      success: true,
      redirect_url: campaign_encounter_path(@campaign, @encounter)
    }
  end

  def ensure_not_ended
    return unless @encounter&.status == "ended"
    redirect_to [@campaign, @encounter], alert: "That encounter has ended."
  end

  private

  def set_campaign
    @campaign = current_user.campaigns.find(params[:campaign_id])
  end

  def set_encounter
    @encounter = @campaign.encounters.find(params[:id])
  end

  def participants_params
    params.require(:participants).permit!.to_h
  end

  def activate_if_ready!
    current_round = @encounter.round_number
    active_participants = @encounter.encounter_participants
                                    .where.not(state: "removed")
                                    .where.not(initiative_roll: nil)
                                    .where("added_in_round IS NULL OR added_in_round <= ?", current_round)

    all_active = @encounter.encounter_participants
                          .where.not(state: "removed")
                          .where("added_in_round IS NULL OR added_in_round <= ?", current_round)
    return unless all_active.count == active_participants.count
    return if active_participants.empty?

    ordered = active_participants.order(initiative_total: :desc, initiative_mod: :desc, id: :asc)
    first_up = ordered.first
    return unless first_up

    if @encounter.status == "setup"
      @encounter.update!(
        status: "active",
        active_participant_id: first_up.id,
        round_number: 1
      )
    elsif @encounter.active_participant_id.nil?
      @encounter.update!(active_participant_id: first_up.id)
    end
  end

  def seed_from_pcs_if_empty!(encounter, campaign)
    return if encounter.encounter_participants.exists?

    campaign.characters.pcs.permanent.find_each do |character|
      encounter.encounter_participants.create!(
        character: character,
        initiative_mod: character.initiative_mod,
        state: "alive"
      )
    end
  end
end
